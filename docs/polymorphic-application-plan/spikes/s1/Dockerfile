ARG NODE=22
FROM public.ecr.aws/lambda/nodejs:${NODE} AS build
RUN dnf install -y gcc-c++ make python3 && dnf clean all
WORKDIR /build
COPY package.json .
RUN npm install --no-audit --no-fund 2>&1 | tail -20
FROM public.ecr.aws/lambda/nodejs:${NODE}
COPY --from=build /build/node_modules ${LAMBDA_TASK_ROOT}/node_modules
COPY handler.js ${LAMBDA_TASK_ROOT}/
CMD ["handler.handler"]
