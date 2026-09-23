# Plastic-IO

Interactive Graph Programming

[Demo](https://plastic-io.github.io/graph-editor/)

# Table of Contents

1. [What is Plastic-IO](#what-is-plastic-io)
    1. [Overview](#overview)
    2. [What is Plastic-IO for?](#what-is-plastic-io-for)
    3. [What are the major features of Plastic-IO?](#what-are-the-major-features-of-plastic-io)
    4. [Where can I run Plastic-IO?](#where-can-i-run-plastic-io)
2. [Installation](#installation)
    1. [Local Sandbox](#local-sandbox)
    2. [Public Editor with Private Graph Server](#public-editor-with-private-graph-server)
    3. [Private Editor and Server](#private-editor-and-server)
3. [Settings](#settings)
4. [Core Concepts](#core-concepts)
    1. [Graph](#graph)
    2. [Nodes](#nodes)
    3. [Edges and Connectors](#edges-and-connectors)
    4. [Calls](#calls)
    5. [View](#view)
    6. [Bus](#bus)
5. [The graph schema](#the-graph-schema)
    1. [One document, not a file](#one-document-not-a-file)
    2. [Document layout](#document-layout)
    3. [What a node carries](#what-a-node-carries)
    4. [What the graph carries](#what-the-graph-carries)
    5. [Namespaces: what kind of change this is](#namespaces-what-kind-of-change-this-is)
    6. [Schema version](#schema-version)
    7. [Projections, revisions and digests](#projections-revisions-and-digests)
    8. [Components and pins](#components-and-pins)
    9. [Calls and instances](#calls-and-instances)
    10. [Placement and deliveries](#placement-and-deliveries)
    11. [Capabilities and the host binding](#capabilities-and-the-host-binding)
    12. [Port contracts](#port-contracts)
    13. [Observations and executions](#observations-and-executions)
    14. [The operations an agent may propose](#the-operations-an-agent-may-propose)
    15. [Where each thing is stored](#where-each-thing-is-stored)
6. [Running a graph](#running-a-graph)
    1. [In the browser](#in-the-browser)
    2. [On the graph server](#on-the-graph-server)
    3. [Across both at once](#across-both-at-once)
7. [Revisions, proposals and admission](#revisions-proposals-and-admission)
8. [Publishing and sharing](#publishing-and-sharing)
9. [Agents](#agents)
10. [Extending The Graph Editor](#extending-the-graph-editor)
11. [Change Update Sequence Diagram](#change-update-sequence-diagram)
12. [Implementing the Graph Scheduler Directly](#implementing-the-graph-scheduler-directly)
13. [Collaborative Editing](#collaborative-editing)
14. [Contributing](#contributing)
15. [Graph Editor Development](#graph-editor-development)

# What is Plastic-IO?

## Overview

Visual programming using a graph interface.  If you can hook up a cable box, you can write programs in Plastic-IO.  Click and drag Nodes into your graph, then connect them together and run it.

## What is Plastic-IO for?

Plastic-IO is a general purpose programming language.  It can be used to create any sort of program in any domain.  Here's a few ideas:

* Build a front facing web site, code and views on the same graph.
* Create a highly mailable services facade to control the shape and flow of your existing APIs.
* Create massively parallel CLI build pipeline.
* Build your entire microservice architecture as reusable Graphs and Nodes.

Declarative graph programming is great for parallel and asynchronous tasks and generally runs faster and can be built in less time than imperative programming.

## What are the major features of Plastic-IO?

* Build your components in the same interface where you build your graph.
* Pure serverless environment.  Plastic-IO only uses lambdas and CDN based client applications.
* Conflict-free replicated data types (CRDTs) let several people edit one graph at once, and let you rewind or fast-forward through its history.
* One program across two domains: each node says where it runs, and a value that reaches a node belonging to the other domain is handed over and comes back.
* Multiuser debug environment for server side _and_ client side programming.
* See the actual animated server data flow in your program _live_ via web sockets, and read back what an execution did as a queryable stream of observations.
* Typescript Graph Scheduling Engine built on promises from the ground up.
* A graph inside a graph is a **call**, not a copy: two uses of the same component share nothing, and a graph may call itself.
* Node code reaches the outside world only through a `host` binding that checks a capability first and records what happened.
* Immutable artifact system allows for instant safe reuse of components in other graphs, with named revisions and digests to say exactly what was published.
* Public and private registries for cataloging and sharing graph components, and an index that answers who is using which version.
* Changes can arrive as proposals — from a person or from an agent over MCP — and are admitted or refused by what kind of thing they touch.
* Graph Design and Presentation views allow for live editing of highly complex asynchronous web sites.

## Where can I run Plastic-IO?

Plastic-IO graphs are domain agnostic.  If it can run JavaScript, it can run a Plastic-IO graph.  Just like JavaScript, Plastic-IO Nodes and graphs can run in mixed domains, although some are dedicated to a specific domain, for example, a Node that reads files from the file system will likely not work in the browser domain, but will work in the server or CLI domains.  Nodes say which domain they belong to (see [Placement](#placement-and-deliveries)), and a graph that spans both runs in both at once.

# Installation

You can install Plastic-IO in three ways.

1. Use the [public version](https://plastic-io.github.io/graph-editor/) in a local sandbox.
2. Use the [public version](https://plastic-io.github.io/graph-editor/) connected to a private graph server.
3. Deploy your own Graph Editor IDE and connect to a private graph server.

The instruction below cover each use case.

## Local Sandbox

1. Open your [graph editor](https://plastic-io.github.io/graph-editor/) and start making graphs.

No installation required.  Graphs and Nodes you make are saved to your browser's IndexedDB, but you can still export them to files to be shared with others.

## Public Editor with Private Graph Server

1. Install the AWS based [Plastic-IO Graph Server](https://github.com/plastic-io/graph-server)
2. Create a free account with [Auth0](https://auth0.com/), setup a SPA and an API for your Graph-Editor and Graph-Server.
3. Configure your settings here at `/graph-editor/provider-settings`.
4. Open your graph editor and start making graphs.

## Private Editor and Server

This is the recommended way to install the program for use in an enterprise environment.  This will ensure that changes to the public graph editor have no impact on your system.

1. Install the AWS based [Plastic-IO Graph Server](https://github.com/plastic-io/graph-server)
2. Create a free account with [Auth0](https://auth0.com/), setup a SPA and an API for your Graph-Editor and Graph-Server.
3. Clone the [graph-editor](https://github.com/plastic-io/graph-editor) repository.
4. Change to the repository directory
5. Run `npm install && npm run build`
6. Copy the content of the `/dist` directory to your CDN.
7. Set your CDN to use the `/dist/index.html` file as the 404 page, and configure the CDN to return 200 status code.
8. Open `/graph-editor/provider-settings` and configure your browser.

# Settings

Which server the editor talks to, and how it authenticates, are **browser settings**, not build settings.  They are entered on the provider settings page and in Settings → Auth0, and they are kept in the browser's local storage, so one build of the editor can be pointed at any server without being rebuilt.

| Setting | Description |
| ------- | ----------- |
| Graph HTTP server | The HTTPS endpoint of your graph server instance, printed when the server is deployed. |
| Graph WSS server | The WSS endpoint of the same instance: document sync, presence, and the live event pipe. |
| Use local storage | When on, graphs live in this browser's IndexedDB and no server is contacted at all. |
| Auth0 domain | Your Auth0 tenant, e.g. `dev-xxxx.us.auth0.com`. |
| Auth0 client ID | The SPA application's client id. |
| Auth0 redirect URI | Where Auth0 returns to; defaults to `/graph-editor/auth-callback` on the current host. |

The access token is minted for the server's API identifier, which defaults to the HTTP server URL without its trailing slash, so in the ordinary case there is nothing to configure.  Login is required only when the server actually checks tokens: an HTTPS server, or one with an explicit audience.  A local dev server on `http://localhost` has no authorizer and needs no login.

Older versions of the editor read `VUE_APP_*` (and later `VITE_*`) variables from a `.env` file at build time.  The application no longer consults them; use the settings page.

# Core Concepts

A graph program is made of:

* Graph
* Nodes
* Edges
* Connectors
* Calls
* View
* Bus

## Graph

[Graphs](https://en.wikipedia.org/wiki/Graph_(discrete_mathematics)) in Plastic-IO are recursive [hypergraphs](https://en.wikipedia.org/wiki/Hypergraph).  Each [node](https://en.wikipedia.org/wiki/Vertex_(graph_theory)) can have unlimited edges connected to unlimited nodes.  Recursion: import your graph into another graph, where it shows up as a node — including into itself.  Graphs have an explicit URL.  You can publish and share graphs.  Graphs can be executed on the client, or the server, or both at once.

## Nodes

Nodes in Plastic-IO are [vertices](https://en.wikipedia.org/wiki/Vertex_(graph_theory)) on a [hypergraph](https://en.wikipedia.org/wiki/Hypergraph).  A node can have an unlimited number of edges making unlimited logical connections.  Nodes have an explicit URL.  The relationship between the nodes, edges and connectors controls the flow of your graph program.

## Edges and Connectors

[Edges](https://en.wikipedia.org/wiki/Graph_(discrete_mathematics)) in Plastic-IO are properties of nodes: one edge per output field.  A **connector** is one wire from an edge to an input field on another node.  Because an edge holds a list of connectors, one field leaving a node can feed many nodes at once — that is what makes the graph a hypergraph rather than a tree, and it is the ordinary case, not an exotic one.

## Calls

A node can carry another graph.  When a value arrives at that node, the inner graph is **instantiated** and the value is delivered inside it; what leaves comes back out of the host node.  That is a call, in the sense any programming language means it, and it has the three properties calls have: the same host reached twice keeps its own state between calls, two hosts carrying the same component share nothing, and a graph reached through itself is a deeper call, which is recursion.  See [Calls and instances](#calls-and-instances).

## View

Each Node has a view.  The graph itself has a view as well.  When you use the graph editor, you can see the view of each Node and graph.  You can edit the view of the Node directly in the IDE.  Although the Plastic-IO execution engine is rendering engine agnostic, this view on the graph editor uses Vue and Vuetify to render views.

Each Node on the graph is registered as a Vue component and native Web Component with the following name `Node-<Node-id>` where `<Node-id>` is the unique ID of the Node.  The graph itself is also registered as a Vue component with the following name `Node-<graph-id>` where `<graph-id>` is the unique id of the graph.  The graph view is only visible when in presentation mode.  By setting the graph to start in presentation mode you can create functional web sites that can be presented to end users.

When a graph is imported into another graph, the graph view template gains the property `Node` that represents the host Node.

## Bus

Each Node has a "set" function. This set function dictates how data flows through all edges of the node.  You can edit the set function of the Node directly in the IDE.  The flow of data through the graph is called "the bus".  Data always flows in one direction, left to right.  This means data always "comes out" of the right hand side of a Node and "goes into" the left side a Node.  If you are familiar with audio engineering this works the same as an audio bus.

# The graph schema

This is the part that has changed most.  A graph used to be a JSON file that a client read, changed and wrote back.  It is now a **document** that many people and programs edit at once, with a plain JSON **projection** taken from it for the things that only read: execution, publishing, and the table of contents.

The schema is defined once, in [`@plastic-io/graph-crdt`](packages/GraphCrdt), and imported by both the editor and the graph server, so the two can never disagree about what a graph is.

## One document, not a file

Each graph is one [Yjs](https://yjs.dev/) document.  Everything in it is addressed by identity rather than by position: nodes live in a map keyed by node id, connectors in a list keyed by connector id, and code in collaborative text.  An edit produces a small binary update; updates commute and are idempotent, so they can arrive in any order, more than once, or after hours offline, and every copy ends up identical.

Two consequences worth stating plainly:

* **Writing never reads.**  The server appends an update and fans it out.  It does not load the graph to save a change, so two people saving at the same moment cannot overwrite one another.
* **A projection is derived, never authored.**  `toJSON(doc)` produces the plain graph the scheduler runs, and that is the only direction the conversion is trusted in.  Anything written back has to go through the document.

## Document layout

    doc.getMap("graph")
      id          string, set once
      url         string
      version     number (a label, not a conflict resolution mechanism)
      properties  Y.Map
        template  Y.Text          the graph's own view, merged character by character
        scripts   Y.Text          graph scope code, likewise
        autonomy  scalar          how much of an agent's work takes effect unreviewed
        ...       scalars         name, description, icon, exportable, height, width, ...
      nodes       Y.Map keyed by node id
      meta        Y.Map
        schemaVersion number      written by the server

    node (a Y.Map inside graph.nodes)
      id, graphId, url, version, artifact        scalars
      data, linkedGraph, linkedNode              opaque JSON, replaced whole
      properties  Y.Map
        name, description, tags                  scalars
        inputs, outputs   Y.Array<Y.Map>         ports, keyed by name
        presentation      Y.Map                  scalars
        groups            Y.Array<string>
        scripts           Y.Text
        component         { publishedId, version, digest }
        placement         "browser" | "server" | "portable"
        containment       "isolate" | "worker"
        capabilities      array of grants
        budget / budgets  limits for one run
        tests, iac        arrays / desired state
        x, y, z, icon, positionAbsolute          layout
      edges       Y.Map keyed by edge field
        <field>   Y.Map
          field       string
          connectors  Y.Array<Y.Map> keyed by connector id
      template    Y.Map
        set  Y.Text     the node's code
        vue  Y.Text     the node's view

`graph.nodes` is a map, so it has no inherent order.  The array the scheduler and the exported JSON want is derived deterministically from `properties.createdOn` then `id`, which every peer computes the same way.  Render order is separately controlled by `properties.presentation.sort`, so nothing user visible depends on array position.

`version` is a last-writer-wins scalar rather than a counter CRDT.  It is a human facing label used for artifact naming and the rewind display, never for conflict resolution.

## What a node carries

| Key | Meaning |
| --- | ------- |
| `id`, `url`, `graphId`, `version` | identity; `url` is how the node is addressed from outside |
| `template.set` | the node's code, run when a value arrives |
| `template.vue` | the node's view |
| `properties.inputs` / `outputs` | ports, each with a name, a declared type and an optional JSON Schema |
| `edges[].connectors` | the wires leaving one output field; many connectors on one field is a hyperedge |
| `properties.component` | the pin: which published component and version this node is a copy of |
| `properties.placement` | `browser`, `server` or `portable` — where this node's code runs |
| `properties.containment` | `isolate` or `worker`: the realm the code runs inside |
| `properties.capabilities` | what the graph owner granted this node beyond its edges |
| `properties.budget` | what one run of it may spend |
| `properties.tests` | what proves it still works |
| `properties.iac` | desired infrastructure, for nodes that describe cloud resources |
| `properties.deliveryTarget` | `initiator` or `all-viewers`, when the server hands work to a browser |
| `data` | the node's own scratch space between runs; opaque to the schema |
| `linkedGraph` / `linkedNode` | the graph or node this one carries, when it is a call |

## What the graph carries

| Key | Meaning |
| --- | ------- |
| `properties.name`, `description`, `icon` | what it is |
| `properties.exportable` | may this graph be imported into another |
| `properties.template`, `scripts` | the graph's own view and graph-scope code |
| `properties.autonomy` | how much an agent may change here without a person seeing it first |
| `properties.height`, `width` | how it appears when imported |
| `meta.schemaVersion` | what the document knows about itself; written by the server |
| `observed*`, `policy`, `acl` | mirrors of observed state and policy; written by the server only |

## Namespaces: what kind of change this is

Every key belongs to a namespace, and the server's admission gate decides on a change by *what kind* of thing it touches rather than by who sent it.  The same table is imported by the editor, so the history panel names a change the way the server does.

| Namespace | What it covers |
| --------- | -------------- |
| `definition` | what the program is: nodes, ports, wiring, names |
| `layout` | where things sit on the canvas |
| `code` | `template.set`, `template.vue`, `scripts` |
| `capabilities` | what a node may do beyond its edges |
| `placement` | which domain a node's code runs in |
| `containment` | the realm it runs inside |
| `policy-autonomy` | whether an agent's work here takes effect unreviewed |
| `budgets` | what a run may spend |
| `tests` | what proves it works |
| `iac` | desired infrastructure |
| `meta`, `observed`, `policy` | written by the server only |
| `housekeeping` | `version` and `lastUpdate`, bumped on every commit; they say nothing about what changed |

Two groups matter more than the rest:

* **Server-owned** — `meta`, `observed`, `policy`.  A client update that touches them is refused whoever sent it, with one exception: the first update of a new graph, which has to stamp the schema version.
* **Privilege** — `capabilities`, `placement`, `containment`, `policy-autonomy`.  Widening any of these, or wiring into a node that is already privileged, needs a stronger authority than an ordinary edit.  A node is privileged when it runs on the server or holds any capability.

Moving a node around and rewriting its code are therefore different kinds of change, and a review can say so.

## Schema version

`SCHEMA_VERSION` is **2**: a graph can now carry what this system asks of it — component pins, placement, containment, capabilities, and what a node provides.  A reader accepts 1 and 2 and refuses only a version beyond this, because that would mean the document knows something the reader does not.  Graphs written before any of this existed still load: what cannot be read from them is left alone rather than guessed at.

## Projections, revisions and digests

The document is the truth; a **projection** is the plain JSON taken from it for execution, publishing and the table of contents.

A **revision** is a named, immutable projection: `rev_<ULID>`, with a sequence number, a label, who cut it, and three digests:

| Digest | Taken over |
| ------ | ---------- |
| `full` | the whole projection |
| `definition` | what the program *is* — no layout, no housekeeping counters |
| `layout` | where things sit, alone |

Two revisions with the same `definition` digest run the same program however differently they are laid out, which is what lets the editor say "nothing about this change affects what it does".  Canonical JSON (keys sorted at every level, no undefined) is what gets hashed, so the digest of the same content is the same everywhere.

A graph has a HEAD revision, and may have an **active** revision, which is what production executes.  Activating one freezes execution there until someone activates another; a graph with none runs what is being edited.

## Components and pins

Publishing a graph or a node writes an immutable **component version**: an artifact plus a manifest.

| Manifest field | Meaning |
| -------------- | ------- |
| `publishedId`, `version`, `kind` | identity; `kind` is `graph` or `node` |
| `digest` | sha256 over the canonical component view — the definition, not the layout |
| `artifactDigest` | sha256 over the artifact exactly as stored |
| `revisionDigest` | the digest of the revision it was published from |
| `contract` | the inputs and outputs it offers |
| `capabilities` | what it requires to work |
| `placement` | where it needs to run |
| `dependencies` | the components it carries, with their versions |
| `summary` | intent, invariants, and whether those were authored or generated |
| `tests`, `budgets` | what proves it, and what it may spend |
| `provenance` | who published it, from which graph and revision, when |
| `counts` | nodes and connectors |

A node that is a copy of a published component carries a **pin**:

    node.properties.component = { publishedId, version, digest }

The pin is what makes "who uses this?" answerable without reading every graph in the instance: the set of pins in a graph is the set of components it consumes, and the server keeps the reverse index as changes are accepted.  Asking it also tells you what publishing a new version would mean for the graphs already using it — which are **behind**, which are **current**, and which are **ahead**, the last meaning a rollback happened or somebody is running a version that was withdrawn.

## Calls and instances

A node that carries a graph carries it in one of two ways:

* **By reference.**  The node pins a published component and the runtime fetches it when the call is made.  The document stays small, and a new version can be adopted deliberately by moving the pin.
* **Embedded.**  A copy travels inside the document (`linkedGraph.graph`).  Nothing is fetched, and nothing changes underneath you.

Either way, running it is a call.  When a value arrives at the host node, an **instance** of the inner graph is made, named by the path of host nodes it was reached through:

| Instance | Meaning |
| -------- | ------- |
| `path` | the host nodes this instance was reached through, outermost first |
| `depth` | how many calls deep this is; the root graph is 0 |
| `graph` | this instance's own copy of the inner document |
| `parent` | the graph it was called from, so what leaves it gets back |
| `state` | scratch belonging to this instance alone |

That naming is what gives calls their properties: the same host reached twice is the same instance and keeps its `data` between calls; two hosts carrying the same component are two instances that share nothing; and a graph reached through itself is a *deeper* path, so it is a new instance with its own everything.  Nothing decides when recursion stops except the graph, the way any recursive function does — the depth ceiling (32 by default) is the safety net for one that does not, and it fails with the path so it is obvious what happened.

Because a node id inside a component belongs to the component's author, the same id appears in every copy at every depth.  Only the pair (instance path, node id) says which one, so that pair is the address: it is what a delivery carries across a domain boundary, what an observation records, and what the editor's read-only *inside a call* view (`/graph-editor/<graphId>/inside/<path>`) navigates by.

## Placement and deliveries

Every node says which domain its code runs in:

| Placement | Meaning |
| --------- | ------- |
| `browser` | runs in the page |
| `server` | runs on the graph server |
| `portable` | runs wherever the execution already is |

When a node does not declare one, it is derived from what it needs: a node holding a secret or writing to S3 cannot run where those are not, and a node touching the DOM cannot run on the server.  Whichever domain is running an execution either runs the node or hands it over; the domain that does not run it still sees it happen, because the hand-off is an observation like any other.

What crosses the boundary is one delivery:

| Field | Meaning |
| ----- | ------- |
| `executionId`, `correlationId`, `seq`, `spanId` | which run this belongs to, and where in it |
| `graphId`, `revisionId` | which graph, at which revision |
| `nodeId`, `field`, `value`, `connectorId` | what should run, on which input, with what |
| `instancePath` | which call it belongs to |
| `target` | `all-viewers` or `initiator` |
| `budgetSlice` | what the receiving domain may spend on it |
| `initiator` | the session that started the execution |

A node that only draws is rendered by every viewer, which is what makes a shared visualisation work.  A node that does something outside the page must happen once, so it goes to the session that started the execution; if that session is gone, nobody runs it and the delivery waits.  One delivery is one unit of work and the same key never runs twice.

Only JSON crosses a boundary.  A function, a symbol, a bigint or a value over the size limit is refused where it is written rather than silently becoming `null` on the other side.

## Capabilities and the host binding

Edges say what a node is wired to.  Capabilities say what else it may do:

    net:https        storage:kv       storage:s3      secret        timer
    browser:dom      browser:storage  aws:cfn         aws:codebuild
    llm              graph:invoke

A capability is a kind plus a list of scope patterns — a hostname (`api.example.com`, `*.example.com`, `*`), a key prefix (`ratelimit/*`), a secret reference (`openai`).  Three layers apply to one invocation and the effective set is their intersection, so nesting can only narrow:

| Layer | Where it comes from |
| ----- | ------------------- |
| instance | the grant the graph owner gave this node (`properties.capabilities`) |
| manifest | what the published component declares it requires |
| principal | what the person or agent running it holds |

Node code reaches the outside world only through the `host` binding, and every call is checked against the effective capabilities before it happens and observed after.  Refused calls are observed too, and the privileged kinds (`secret`, `storage:s3`, `aws:cfn`, `aws:codebuild`) are audited.  One implementation serves both domains: where an effect cannot happen — a secret in the browser — the capability is still checked and the answer names placement rather than a missing global, so the same node reads the same way in both places.

## Port contracts

A port may declare a type and a JSON Schema, and two different questions are asked about it.  At **connect time** the editor asks whether an output may feed an input at all, which can be answered from the declared types alone: same type, or either side untyped.  Where the schemas make a conflict visible — one produces a string and the other expects a number, or the input requires a property the output never produces — the editor says so while you are drawing the wire.  At **delivery time** the runtime validates the value against the port's schema; a violation is recorded as a `contract.violation` observation, or drops the delivery outright in reject mode.

## Observations and executions

An execution records what it did as an ordered stream, in both domains, with the same meaning either side:

| Kind | What it says |
| ---- | ------------ |
| `exec.begin`, `exec.end`, `exec.error` | a run started, finished, or failed |
| `edge.input`, `edge.output`, `route` | a value arrived, left, or was routed |
| `effect`, `effect.denied` | a capability was used, or refused |
| `budget.exhausted` | a run hit its limit |
| `contract.violation` | a value did not match the port's schema |
| `component.unresolved` | a call could not load the component it names |
| `deploy.status`, `test.result`, `summary.generated` | infrastructure, tests, generated summaries |
| `custom` | whatever a node emitted itself, through `host.emit` |
| `gap` | observations were dropped, and how many |

Each observation carries the addresses that make it joinable: `executionId`, `seq`, `spanId`/`parentSpanId`, `correlationId`, `graphId`, `revisionId`, `instancePath`, `nodeId`, the domain it happened in, and who it was for.  Payloads are captured and redacted per port, and volume is capped, so a busy graph does not write itself out of readability.  The execution record itself says how it ended, how many hops and errors there were, what it spent, and where its observations are.

## The operations an agent may propose

An agent does not send document bytes.  It says what it wants in the same vocabulary the diff engine reports, and the server applies those operations to the projection and reconciles the document into the result — the same reconciler the editor uses, so a proposal maps exactly onto changes an editor could have made:

    add-node            remove-node         set-node-code       set-node-props
    set-graph-props     connect             disconnect          set-component-pin
    set-capabilities    set-placement       set-containment     set-budget
    set-iac-desired

Every operation is checked against the graph as it stands, and the first failure stops the batch: a proposal is one transaction.  The privileged node properties (`component`, `capabilities`, `placement`, `containment`, `budget`, `tests`, `iac`) cannot be reached through a generic property patch; they have operations of their own, so that a change to them is visible as what it is.

## Where each thing is stored

    graphs/<id>/crdt/v2/updates/<ulid>~<label>.bin   one update, with its label
    graphs/<id>/crdt/v2/snapshots/<ulid>.bin         merged state up to <ulid>
    index/toc/crdt/v2/...                            the list of graphs, itself a document
    graphs/projections/latest/<id>.json              plain JSON, for execution
    revisions/<graphId>/<revisionId>.json            the revision record and its digests
    revisions/<graphId>/<revisionId>.projection.json the projection it names
    revisions/<graphId>/HEAD.json                    the newest revision
    active/<graphId>.json                            what production executes
    components/<publishedId>/<version>/manifest.json a published version
    components/<publishedId>/<version>/artifact.json the artifact itself
    components/<publishedId>/HEAD.json               the newest version
    components/<publishedId>/consumers/<graphId>.json who carries it
    consumers/by-graph/<graphId>.json                what a graph carries
    proposals/<graphId>/<proposalId>.json            a proposed change and its state
    executions/<executionId>.json                    what one run did
    executions/by-graph/<graphId>/<executionId>.json runs of one graph
    policy/agents/<agentSub>/<graphId>.json          what an agent was delegated
                                                     (`_all.json` for every graph)

Snapshots are an optimisation, never the source of truth, and updates are kept after one is written: the log is also what the rewind feature replays.

# Running a graph

## In the browser

A graph can be executed directly in the design view of the editor, and you can also set your graph to **presentation mode**, where nodes not marked "Visible in Presentation" are hidden and the graph's own template is displayed.

A set function is called with named parameters rather than reading everything off `this`:

| Parameter | Description |
| --------- | ----------- |
| `value`, `field` | what arrived, and which input it arrived on |
| `edges` | the node's outputs; assigning to one sends a value along its connectors |
| `data` | this node's scratch space, kept between runs |
| `state` | the scheduler's state, shared by the run |
| `properties`, `node`, `graph`, `cache`, `scheduler` | what it is and where it is running |
| `host` | the capability-checked binding: fetch, storage, secrets, `emit`, `signal`, `cancelled` |
| `instance` | which call this node is running in — its `path`, `depth` and its own `state` — when it is inside one |

In the browser, `this` additionally carries the view:

| Property | Description |
| -------- | ----------- |
| `props` | Vue component props of this node |
| `component` | the Vue component instance |

## On the graph server

Graphs are reachable by URL:

    <root>/<graph.url>.<graph.node[].url>

    Example: the following URL runs node "html" on graph "home"
    https://mysite.com/home.html

If no node URL is given, `index` is assumed; likewise for the graph.  On the server, `this` carries the AWS `event`, `context` and `callback`, and a websocket `console` that sends log data to the editor.  The parameters above are the same in both domains, so the same node reads the same way wherever it runs.

    // example callback
    this.callback(null, {
        statusCode: 200,
        body: "Hello World!"
    });

If you do not call it within 30 seconds it is called for you and a timeout is logged.  Your lambda can run longer than that, but API Gateway requires the HTTP response within 30 seconds.

## Across both at once

A graph is one program whose nodes may belong to different domains, so a single execution can move between them: the server runs what is placed there, hands a browser node to the page (as a delivery), and the page hands back what leaves it.  Both sides record observations into the same stream, so one query answers for the whole run, and the editor can show it as one thing.

This is what makes a graph with a visualisation in it, or a form in front of a privileged effect, a single program rather than two programs and a protocol.

# Revisions, proposals and admission

Every change to a graph goes through the same gate, whether it comes from a person editing, a rollback, a migration or an agent:

1. **Staging.**  The update is applied to a copy, not to the stored document.
2. **Semantic diff.**  What actually changed is worked out, by namespace: layout, code, definition, capabilities, placement, and so on.
3. **Decision.**  What the diff requires is compared with what the principal holds.  Every commit needs the authority to commit; widening what a node may do, or wiring into a node that is already privileged, needs more; reaching into the cloud account needs the infrastructure approver.
4. **Acceptance.**  The update is appended, fanned out to everyone editing, and recorded in the audit chain.
5. **After the fact.**  Derived data — the consumers index, summaries — is brought up to date by hooks that run *after* acceptance and cannot refuse it.  An index that can refuse an edit is a worse index than a stale one, and derived data can always be rebuilt.

A **proposal** is a change somebody has asked for but not yet made: operations against a named base revision, validated, with its impact worked out (what it touches downstream, which consumers it affects, what privileges it would add).  It is simulated and committed by a person in the editor, and a proposal whose base has moved on says so and offers the revision to rebase onto.

# Publishing and sharing

Publishing writes an immutable version: the artifact, a manifest, and a pointer to the newest version.  Past versions stay exactly as they were, so a graph that pins one is not changed by somebody else's release.  What a version had to pass before it could be published — its tests, its intent journeys — is part of the record.

Two ways to use somebody's work:

* **Published components**, which are pinned by id and version, fetched at call time, and tracked: the registry knows who is using which version, so a publisher can see what a new release would mean before making it.
* **Files**, downloaded from the editor and dragged onto a graph.  The imported artifact then originates on your graph and nothing is linked.

# Agents

The graph server speaks [MCP](https://modelcontextprotocol.io/) at `POST /mcp`, so an agent can read a graph and propose changes to it with the same services the editor uses — nothing reaches the store or the scheduler directly.

* **Reading:** `graph.summary`, `graph.expand`, `component.search`, `component.consumers`, `observations.query`, and resources for graphs, revisions, nodes, history, diffs, executions, proposals, published components and their consumers.
* **Changing:** `proposal.create`, `proposal.validate`, `proposal.simulate`, `proposal.decide`, `proposal.commit` — and a human commits in the editor.
* **Running:** `graph.invoke`, `execution.cancel`, `tests.run`, `journey.run`, plus `tasks.*` for work that outlives one call.
* **Revisions and publishing:** `revision.cut`, `revision.activate`, `revision.rollback`, `component.publish`.
* **Discovering itself:** `plastic://me` says what the caller is and what it holds, so an agent does not have to learn its authority by being refused something.

An agent's authority is a **delegation**: a record saying what a person let it do, on which graph, until when.  Its effective authority is the intersection of its token and that delegation; no record, no authority.  Answers are bounded by it — asking which graphs use a component names only the graphs the caller could have read directly.

Every call is admitted by the same gate as an editor's change, recorded in the audit chain, and rate limited.  Clients authenticate with OAuth: the server advertises its protected-resource metadata, and a client that arrives with no token is told where to get one.

# Extending The Graph Editor

You can add your own components to the graph editor using the vue plugin framework.  This is the way the graph editor imports its own components.

# Change Update Sequence Diagram

    +-----------+  +-------------------+  +------------------+  +------------------+
    |           |  |                   |  |                  |  |                  |
    |  Browser  |  |  Graph Document   |  |  Browser Storage |  |   Graph Server   |
    |           |  |     (Yjs doc)     |  |   (IndexedDB)    |  |    (S3 + WSS)    |
    +-----+-----+  +---------+---------+  +---------+--------+  +---------+--------+
          |                  |                      |                     |
          +----Change------> |                      |                     |
          |                 +++---Update----------> |                     |
          |                 | |---Update-----------------------------> +--+--+
          |                 | |                     |                  |     |
          |                 | | <---------Update from another person---+-----+
          | <---Re-render---+++                     |                     |
          |                  |                      |                     |

An edit becomes a small binary update rather than a diff against a shared
baseline.  Updates commute, so the order they arrive in does not matter and two
people editing at once cannot overwrite each other.  The server never reads a
graph in order to write one: it appends the update and passes it on.

# Implementing the Graph Scheduler Directly

If you use the Graph-Editor and Graph-Server together all of this is abstracted from you and you can concentrate on graph programming.  However if you want to use the scheduling engine directly, it is very easy to do.

Build a graph, hand it to the scheduler, and name the node to start at:

```javascript
const scheduler = new Scheduler(graph, {}, {}, console);
await scheduler.url("my-nodes-url");
```

`url()` resolves when the execution has **ended**: every set function and every connector delivery it started has settled, its budget ran out, or it was cancelled.  `invoke()` returns the handle behind that promise:

```javascript
const handle = scheduler.invoke("index", value, "field", undefined, {
    budget: {wallMs: 5000, hops: 10000, fanOut: 1000, depth: 256},
});
handle.cancel("user pressed stop");   // cooperative: refused at the next hop
const result = await handle.done;     // never rejects
```

Things worth knowing when you drive it yourself:

* Every event carries `executionId` and `seq`, and edge-level events carry `spanId` and `parentSpanId`, so a run can be reconstructed from its events alone.
* Node code receives a `host` binding — `host.executionId`, `host.cancelled`, `host.signal` (an `AbortSignal` for fetch), `host.throwIfCancelled()`, `host.emit(kind, data)`, `host.now()`, `host.random()` — plus whatever the embedder adds through `new Scheduler(graph, context, state, logger, {host})`.
* A linked graph is a **call**: `instanceFor` makes or finds the instance a host node stands for, `instanceAt(path)` walks to the one a path names, and `invokeIn(instancePath, url, value, field)` delivers a value into that call, which is how another domain answers a hop that belongs inside a call.  Instances are keyed by path, so recursion works and two uses of one component share nothing.
* `onInput` / `onOutput` hooks validate values entering and leaving nodes; a thrown error is a contract violation, and in reject mode it drops the delivery.
* Running out of budget emits one error with `code: "BUDGET_EXCEEDED"` and cancels the execution.  A cancellation that cannot drain in time ends as `abandoned`.

## Going Deeper

Scheduling engine documentation: [Scheduler](https://plastic-io.github.io/plastic-io/classes/_scheduler_.scheduler.html)

# Collaborative Editing

Plastic-IO graphs are [conflict-free replicated data types](https://en.wikipedia.org/wiki/Conflict-free_replicated_data_type),
built on [Yjs](https://yjs.dev/).  Each graph is one document, and everything
in it is addressed by identity rather than by position: nodes live in a map
keyed by node id, connectors in a list keyed by connector id, and code in
collaborative text.

That addressing is what makes concurrent editing safe.  If you delete a node
while a colleague drags another one, their drag lands on the node they grabbed,
not on whatever moved into that slot.  If you rename an output while they wire
a connector to it, both changes survive.  If you both type in the same node's
set function, the edits merge character by character.

An edit produces a small binary update.  Updates commute and are idempotent, so
they can arrive in any order, more than once, or after hours offline, and every
copy of the graph ends up identical.  There is no central lock and no rebase.

## Where changes are kept

* **In your browser.**  The document is persisted to IndexedDB, so a graph
  opens instantly and keeps working with no network at all.  Alongside it, an
  append-only log records every update with the name of the action that
  produced it; that log is what the rewind transport replays.
* **On the graph server.**  Each update is written to its own object in S3 and
  passed on to everyone else editing that graph.  Writes never read, so two
  people saving at the same moment cannot overwrite one another.  Periodically
  the log is folded into a snapshot, and the plain JSON projection that graph
  execution and publishing read is refreshed.

## Undo and presence

Undo is per person.  The undo stack follows only the changes you made, so
undoing your own work never reaches into a colleague's.  Everyone's pointer,
selection and identity travel on a separate presence channel that is never
stored and disappears when they close the tab.

# Contributing

We offer a very free and open environment where you can express yourself in a multitude of ways, and showcase your creations to the world!  There are four major paths of contribution.

## Graphs and Nodes

Always looking for contributors to our public catalog.  At Plastic-IO we maintain a catalog of user generated graphs and Nodes that are available by default to all installation of the graph-editor.

You can contribute to the core public artifact registry by making pull requests to the [Graph Registry](https://github.com/plastic-io/registry) repository.  From there you can create categories and sub-categories of your work and make it available to the public.

Your creations can be in any domain (browser, aws server, CLI), and you can use your own creations to make new creations.  Even mix and match creations from other people in your new creations and repeat.

Here's a few ideas:

* Navigation bar component with drop down menus
* Reusable table with XHR paging support
* Closed loop CRUD system for your favorite AWS data storage solution
* Web page skeleton that people can modify to make their own
* Build pipeline configuration builder
* Admin web site with basic CRUD functionality
* MIDI component synthesizer using a lib like [Tone.js](https://tonejs.github.io/)
* Visualization pipeline using a lib like [Threejs](https://threejs.org/)

Make them and publish them so others can use them directly or use them as building blocks in another creation.

## Graph Editor IDE

The Graph Editor IDE itself is always in need of love.  Built with Typescript, Vue 3, Pinia, and Vuetify, the graph-editor both produces the graphs that are executed by the scheduling engine, but also renders the views built into the graphs and Nodes.  It is also responsible for displaying events that occur in the graph execution runtime environment, both on the server and the browser using web sockets.

Contributing to the graph editor is not for beginners, but there are some tickets that are easier to accomplish than others.  If you think you're up to the task check out the [issues](https://github.com/plastic-io/graph-editor/issues) page and look for the "good first time issue" tag.

## Graph Server Lambda

The [Graph Server](https://github.com/plastic-io/graph-server) is an AWS HTTP Lambda {proxy+} implementation of the graph server.  Using CRDT document sync and a publishing pipeline, the graph server lambda represents an entire micro service architecture framework.  Graphs are accessed via their registered URLs and served to the users as HTTPS APIs.  Graphs running on the graph server have full access to the AWS infrastructure and can do anything AWS allows.

Work on the graph server is not for beginners.  Here we are creating new O(1) routing paradigms that fit with graph programming.  Additionally the graph server is used to communicate debugging and business intelligence events to AWS cloud watch and the Graph Editor IDE.  These are highly complex system and require a skilled and careful hand to maintain.  If you think you're up for it check out the [issues](https://github.com/plastic-io/graph-server/issues) list on the graph server.

## Artwork

There is a limited set of [media assets](https://github.com/plastic-io/media) here.  Contributions to the asset set is always welcome.  There are no current issues opened, but feel free to create an issue and make a PR.



# Graph Editor Development

Graph Editor IDE for the plastic-io graph programming language

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```

### Run Unit Tests with [Vitest](https://vitest.dev/)

```sh
npm run test:unit
```

### Run the schema and document tests

```sh
npm run test:crdt          # the shared schema package
npm run test:integration   # the editor against the schema, end to end
npm run test:e2e:crdt      # ten thousand events through the real pipeline, with timings
```

The last one prints document sizes as well as timings, because the size is the
assertion that matters: it compares the document against what a brand new
document holding the same graph would cost.

### Run the two-browser tests with [Playwright](https://playwright.dev/)

```sh
npm run test:hybrid
```

These are about what **two** people watching one graph each do with a hop the
server hands to the browsers, which a single page cannot answer.  They start the
graph server (in memory, no AWS) and the editor on ports of their own.

### Type-check

```sh
npm run type-check          # vue-tsc over the whole project
npm run type-check:ratchet  # the same, against a baseline that may only go down
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```

## Where the schema lives

The graph schema, the reconciler, the semantic diff, the digests and the
operations an agent may propose are all in [`packages/GraphCrdt`](packages/GraphCrdt),
published as `@plastic-io/graph-crdt` and imported by the graph server as an
ordinary dependency.  It must never depend on Vue, Pinia, the DOM or Node
built-ins: it is the one place the two sides agree on what a graph is.
