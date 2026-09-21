#!/bin/bash
# usage: run.sh <platform> <node-major> <tag>
set -u
PLATFORM=$1; NODE=$2; TAG=$3
cd "$(dirname "$0")"
echo "== build $TAG ($PLATFORM, nodejs:$NODE) $(date -u +%H:%M:%S)"
docker build --platform $PLATFORM --build-arg NODE=$NODE -t $TAG . > build-$TAG.log 2>&1; BUILD=$?
echo "build exit $BUILD $(date -u +%H:%M:%S)"; tail -5 build-$TAG.log
[ $BUILD -ne 0 ] && exit 1
docker rm -f $TAG >/dev/null 2>&1
docker run --platform $PLATFORM -d --name $TAG -p 0:8080 -e AWS_LAMBDA_FUNCTION_MEMORY_SIZE=1024 $TAG >/dev/null
PORT=$(docker port $TAG 8080/tcp | head -1 | sed 's/.*://'); sleep 3
du -sh $(docker run --rm --platform $PLATFORM --entrypoint sh $TAG -c 'du -sh /var/task/node_modules/isolated-vm 2>/dev/null | cut -f1') 2>/dev/null
echo "== invoke 1 (cold) $(date -u +%H:%M:%S)"
curl -s -m 120 -X POST "http://localhost:$PORT/2015-03-31/functions/function/invocations" -d '{}' > result-$TAG-1.json; echo; python3 -m json.tool result-$TAG-1.json | head -80
echo "== invoke 2 (warm, after OOM in invoke 1) $(date -u +%H:%M:%S)"
curl -s -m 120 -X POST "http://localhost:$PORT/2015-03-31/functions/function/invocations" -d '{"cases":["baseline","after-oom","callback-ok"]}' > result-$TAG-2.json; echo; python3 -m json.tool result-$TAG-2.json | head -40
docker logs $TAG 2>&1 | grep -iE "error|fatal|oom|killed" | head -10
docker rm -f $TAG >/dev/null 2>&1
echo "== done $TAG $(date -u +%H:%M:%S)"
