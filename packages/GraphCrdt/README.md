# @plastic-io/graph-crdt

The shared definition of a Plastic-IO graph as a [Yjs](https://yjs.dev/)
document. Imported by both the graph editor and the graph server, so it must
never depend on Vue, Pinia, the DOM, or Node built-ins.

## What is in here

| Module | Purpose |
| ------ | ------- |
| `schema.ts` | how a graph maps onto Yjs types, and why |
| `codec.ts` | `fromJSON` and `toJSON` between a graph and a document |
| `reconcile.ts` | turn "the graph should look like this" into granular operations |
| `text.ts` | character-level updates for collaborative text |
| `updates.ts` | which Yjs update format this project speaks |
| `protocol.ts` | the sync and presence wire format |
| `namespaces.ts` | which part of a graph each key belongs to (layout, code, definition, privilege) |
| `diff.ts` | the semantic difference between two projections, as the server's admission gate sees it |
| `digest.ts` | canonical JSON and the definition/layout views a revision's digests are taken over |

## The update format

Yjs ships two encodings for document updates, and this project uses V2
throughout: on the wire, in browser storage, and in S3. The Yjs README
recommends it for anyone building their own provider, and on a graph it is
worth about 35 to 40 percent.

Every call goes through `updates.ts` rather than reaching for Yjs directly.
That is not tidiness. The two encodings are not interchangeable and a mistake
does not announce itself: handing V2 bytes to the V1 reader raises no error, it
decodes them into a different document. Centralising the choice means there is
one place to read and one place to change.

Three things follow from that, and all three are load-bearing:

* A `Y.Doc` emits `update` and `updateV2` for the same transaction. Listening
  for the wrong one is the easiest way to introduce the bug above, so nothing
  here writes the event name inline; it comes from `UPDATE_EVENT`. A provider
  that speaks V1, such as y-indexeddb, keeps working alongside this untouched.
* The format is stamped on wire messages and is part of the S3 key prefix
  (`crdt/v2/...`), so a mismatch is refused rather than decoded, and two
  formats can never land in the same listing.
* State vectors are identical in both encodings, so only update payloads are
  affected.

## The reconciler

The editor has dozens of actions that mutate a plain JavaScript copy of the
graph. Rewriting every one of them to write Yjs operations by hand would have
been a large and error-prone change, so `reconcile(doc, graph)` takes the
mutated copy and emits the smallest set of operations that will bring the
document in line with it.

Matching is by identity, never by position: nodes by id, connectors by id,
inputs and outputs by name, edges by field. That is what lets one person delete
a node while another moves a different one without the two changes colliding.
Strings that hold code are compared by common prefix and suffix, so a one
character edit sends one character.

## One copy of Yjs, always

Yjs uses `instanceof` checks internally, so two copies of the library in one
process break everything in confusing ways. This package declares `yjs` as a
peer dependency and never bundles it, but because it is consumed through a
symlink across two repositories, a tool that resolves symlinks will find the
*other* repository's copy.

Both consumers pin this explicitly, and anything new that imports this package
has to do the same:

* `graph-server/webpack.config.js` sets `resolve.symlinks: false`
* `graph-server/jest.config.cjs` maps `^yjs$` and `^lib0/(.*)$` to its own copy

If you ever see `Yjs was already imported`, this is why.

## Syncing

Two peers reconcile by exchanging state vectors and sending only the difference,
which is the pattern the Yjs README documents under "Sync two clients by
computing the differences" and "Syncing clients without loading the Y.Doc".

The server never loads a document into memory to do this. It holds the graph as
merged binary updates and works on those directly:

```js
const serverVector = Y.encodeStateVectorFromUpdate(storedState);
const forTheClient  = Y.diffUpdate(storedState, clientStateVector);
```

The editor sends its state vector when it asks for a graph, so a browser that
has the graph in local storage downloads only what changed while it was away.
Measured on an eight node graph: a first visit transfers 21,477 bytes, a return
visit transfers 38.

The socket handshake still runs afterwards and covers reconnects, but by then
the two sides are usually already in step, so it costs a few dozen bytes.

## Undo history and document size

Yjs collects the contents of deleted items, but `Y.UndoManager` pins everything
in its scope so that it can put it back. An unbounded undo history therefore
means an unbounded document, and this is the single largest factor in how large
a graph becomes:

| 600 create-and-delete events, 50 nodes live | Document |
| --- | --- |
| history unbounded | 347 KB |
| history bounded to 50 actions | 39 KB |

So the session keeps a bounded number of undoable actions. When an action falls
off the end, the items it was holding are released and collected. Without that
release the bound alone changes nothing, because collection runs when a deletion
happens and skips anything marked to keep.

## Measured behaviour

`npm run test:e2e:crdt` runs ten thousand events through the real pipeline and
prints timings and document sizes. From a run on a developer laptop:

| Workload | Mean per event | Document vs. the same content freshly built |
| -------- | -------------- | ------------------------------------------- |
| 10k text edits (one keystroke each) | 0.009 ms | 10.7 KB for 10k characters |
| 10k property writes over 200 nodes | 1.0 ms | 1.02x |
| 10k structural events across two peers | 0.42 ms | 3.4x |

The size column is the assertion that matters. It compares the document against
what a brand new document holding the same graph would cost, so it says the
document tracks the graph in it rather than the number of times it has been
edited.

Two things those runs make visible.

**Saving costs what the graph costs.** Reconciling the snapshot walks the whole
graph, so one save is 0.23 ms at ten nodes and 4.3 ms at five hundred. That is
fine for the discrete actions that use it, and it is the reason continuous
gestures and code editing write to the document directly instead.

**A document is larger than its live content, by a bounded factor.** A deletion
leaves a marker behind so that concurrent edits can still be ordered against it.
Ten thousand create-and-delete events on a three hundred node graph leave a
document about three times the size of that graph, and that ratio does not climb
with further editing. Before the undo history was bounded the same run left
2.2 MB, seven times larger.

**The encoding matters as much as the algorithm.** The same ten thousand event
run measures 232 KB in V2 against 355 KB in V1, a 35% saving. The effect is
larger still on repeated writes to the same field: ten thousand position
changes over two hundred nodes leave a document 1.02 times the size of that
graph freshly built, against 2.04 times in V1.

Taken together, the two changes on this page move that ten thousand event run
from 2.2 MB to 232 KB.
