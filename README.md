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
3. [provider-settings](#provider-settings)
4. [How does this work?](#how-does-this-work)
    1. [Core Concepts](#core-concepts)
        1. [Graph](#graph)
        2. [Nodes](#Nodes)
        3. [View](#view)
        4. [Bus](#bus)
    2. [What are Plastic-IO Graphs?](#what-are-plastic-io-graphs)
    3. [Executing Graphs on the browser](#executing-graphs-on-the-browser)
    4. [Executing Graphs on the Graph Server](#executing-graphs-on-the-graph-server)
    5. [Environments and Publishing](#environments-and-publishing)
    6. [Sharing Nodes and Graphs](#sharing-Nodes-and-graphs)
        1. [Infrastructure as a Graph](#infrastructure-as-a-graph)
        2. [Maximize Code Reuse](#maximize-code-reuse)
5. [Extending The Graph Editor](#extending-the-graph-editor)
    1. [How To Create A Plugin](#how-to-create-a-plugin)
    2. [Plugin Types](#plugin-types)
    3. [Plugin Components](#plugin-components)
    4. [Plugin Template](#plugin-template)
6. [Change Update Sequence Diagram](#change-update-sequence-diagram)
7. [Implementing the Graph Scheduler Directly](#implementing-the-graph-scheduler-directly)
    1. [Going Deeper](#going-deeper)
8. [Operational Transformation](#operational-transformation)
9. [Contributing](#contributing)
    1. [Graphs and Nodes](#graphs-and-Nodes)
    2. [Graph Editor IDE](#graph-editor-ide)
    3. [Graph Server Lambda](#graph-server-lambda)
    4. [Artwork](#artwork)
10. [Graph Editor Development](#graph-editor-development);

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
* Operational Transformation ensures you can rewind or fast-forward changes made to your graph.
* Multiuser debug environment for server side _and_ client side programming.
* See the actual animated server data flow in your program _live_ via web sockets.
* Typescript Graph Scheduling Engine built on promises from the ground up.
* Distributed graph schema allows for in-line or runtime side loaded resources to optimize performance.
* Immutable artifact system allows for instant safe reuse of components in other graphs.
* Public and private registries for cataloging and sharing graph components.
* Graph Design and Presentation views allow for live editing of highly complex asynchronous web sites.

## Where can I run Plastic-IO?

Plastic-IO graphs are domain agnostic.  If it can run JavaScript, it can run a Plastic-IO graph.  Just like JavaScript, Plastic-IO Nodes and graphs can run in mixed domains, although some are dedicated to a specific domain, for example, a Node that reads files from the file system will likely not work in the browser domain, but will work in the server or CLI domains.  Nodes and graphs are tagged with which domains they work in, so you can make sure you're using the right kind.

# Installation

You can install Plastic-IO in three ways.

1. Use the [public version](https://plastic-io.github.io/graph-editor/) in a local sandbox.
2. Use the [public version](https://plastic-io.github.io/graph-editor/) connected to a private graph server.
3. Deploy your own Graph Editor IDE and connect to a private graph server.

The instruction below cover each use case.

## Local Sandbox

1. Open your [graph editor](https://plastic-io.github.io/graph-editor/) and start making graphs.

No installation required.  Graphs and Nodes you make are saved to your browser's local IndexedDB, but you can still export them to files to be shared with others.

## Public Editor with Private Graph Server

1. Install the AWS based [Plastic-IO Graph Server](https://github.com/plastic-io/graph-server)
2. Create a free account with [Auth0](https://auth0.com/), setup a SPA and an API for your Graph-Editor and Graph-Server.
3. Configure your provider settings here at `/graph-editor/provider-settings`.
4. Open your graph editor and start making graphs.

## Private Editor and Server

This is the recommended way to install the program for use in an enterprise environment.  This will ensure that changes to the public graph editor have no impact on your system.

1. Install the AWS based [Plastic-IO Graph Server](https://github.com/plastic-io/graph-server)
2. Create a free account with [Auth0](https://auth0.com/), setup a SPA and an API for your Graph-Editor and Graph-Server.
3. Clone the [graph-editor](https://github.com/plastic-io/graph-editor) repository.
4. Change to the repository directory
5. Optional: add a .env file using [the instructions below](https://github.com/plastic-io/graph-editor#provider-settings).
6. Run `npm install && npm run build`
7. Copy the content of the `/dist` directory to your CDN.
8. Set your CDN to use the `/dist/index.html` file as the 404 page, and configure the CDN to return 200 status code.
9. Open `/graph-editor/provider-settings` and configure your browser. 

# Provider Settings

When using the public CDN graph editor, you can change which server you're connected to by visiting the [provider settings page](https://plastic-io.github.io/graph-editor-vue-2/provider-settings) on the public graph editor.  The settings are saved to the browser.

Alternatively, you can deploy your own instance of the graph editor to your own CDN.  This makes it so the graph editor is hosted in your network where you have more control over it.  When hosted this way, you can automatically fill out the values of provider settings page by setting an `.env` file in the root of your project with the following values:

| Property                         | Description                                                                              |
| -------------------------------- | ---------------------------------------------------------------------------------------- |
| VUE_APP_GRAPH_HTTP_SERVER        | The HTTPS endpoint of your graph server instance, provider after graph server deploy.    |
| VUE_APP_GRAPH_WSS_SERVER         | The WSS endpoint of your graph server instance, provider after graph server deploy.      |
| VUE_APP_AUTH_PROVIDER_NAME       | The authentication provider name.  Currently only auth0 is supported.                    |
| VUE_APP_AUTH_DOMAIN              | The authentication domain name.  Provided by your authentication provider.               |
| VUE_APP_AUTH_CLIENT_ID           | The authentication client ID.  Provided by your authentication provider.                 |
| VUE_APP_AUTH_AUDIENCE            | The authentication audience.  Provided by your authentication provider.                  |
| VUE_APP_FORCE_SERVER             | When true, the provider-settings page is disabled and forced to use the above settings.  |


Example `.env` file:

  VUE_APP_GRAPH_HTTP_SERVER=https://7hcv242f49.execute-api.us-east-1.amazonaws.com/dev/
  VUE_APP_GRAPH_WSS_SERVER=wss://w84525agw3.execute-api.us-east-1.amazonaws.com/dev
  VUE_APP_AUTH_PROVIDER_NAME=auth0
  VUE_APP_AUTH_DOMAIN=dev-32-g55ap.us.auth0.com
  VUE_APP_AUTH_CLIENT_ID=V352372k7efF4asfsJyizdfasasUKl
  VUE_APP_AUTH_AUDIENCE=plastic-io-graph-server
  VUE_APP_FORCE_SERVER=false


# How does this work?

## Core Concepts

In this integrated development environment (IDE), you can create and share graph programs.  Graph programs consist of 4 major parts:

* Graph
* Nodes
* Edges
* Connectors
* View
* Bus

### Graph

[Graphs](https://en.wikipedia.org/wiki/Graph_(discrete_mathematics)) in Plastic-IO are recursive [hypergraphs](https://en.wikipedia.org/wiki/Hypergraph).  Each [node](https://en.wikipedia.org/wiki/Vertex_(graph_theory)) can have unlimited edges connect to unlmited nodes.  Recursion: Import your graph into another graph where it will show up as a Node.  Graphs are made up of a collection of Nodes and Edges.  Graphs have an explicit URL.  You can publish and share graphs.  Graphs can be executed on the client, or server, or both.  Graphs are domain agnostic.  It can execute anywhere JavaScript can execute.

### Nodes

Nodes in Plastic-IO are [vertices](https://en.wikipedia.org/wiki/Vertex_(graph_theory)) on a [hypergraph](https://en.wikipedia.org/wiki/Hypergraph).  Your node can have an unlimited number of edges making unlimited logical connections.  Nodes have an explicit URL.  The relationship between the Nodes, edges and connectors controls the flow of your graph program.

### Edges

[Edges](https://en.wikipedia.org/wiki/Graph_(discrete_mathematics)) in Plastic-IO are properties of nodes.  Plastic-IO utilizes recursive hypergraphs.  This means every node can have an unlimited number of edges.  Edges connect one node to another forming the flow of your program.

### View

Each Node has a view.  The graph itself has a view as well.  When you use the graph editor, you can see the view of each Node and graph.  You can edit the view of the Node directly in the IDE.  Although the Plastic-IO execution engine is rendering engine agnostic, this view on the graph editor uses Vue and Vuetify to render views.

Each Node on the graph is registered as a Vue component and native Web Component with the following name `Node-<Node-id>` where `<Node-id>` is the
  unique ID of the Node.  The graph itself is also registered as a Vue component with the following name `Node-<graph-id>` where `<graph-id>` is the unique id of the graph.  The graph view is only visible when in presentation mode.  By setting the graph to start in presentation mode you can create functional web sites that can be presented to end users.

When a graph is imported into another graph, the graph view template gains the property `Node` that represents the host Node.

### Bus

Each Node has a "set" function. This set function dictates how data flows through all edges of the node.  You can edit the set function of the Node directly in the IDE.  The flow of data through the graph is called "the bus".  Data always flows in one direction, left to right.  This means data always "comes out" of the right hand side of a Node and "goes into" the left side a Node.  If you are familiar with audio engineering this works the same as an audio bus.

## What are Plastic-IO Graphs?

Plastic-IO graphs are a high level graph programming language built on top of JavaScript and executed with the [Plastic-IO Scheduling Engine](https://github.com/plastic-io/plastic-io).  Plastic-IO graphs are stored as JSON files.  The GUI for Plastic-IO is the [Plastic-IO Graph Editor IDE](https://github.com/plastic-io/graph-editor).

## Executing Graphs on the browser

Graph can be executed directly in the design view of the editor, however you can also set your graph to "Presentation Mode".
In presentation mode, nodes not marked "Visible in Presentation" will be hidden.  The template that is displayed is defined
on the graph properties.  From this template you can display other Nodes on your graph or enter your own template code.

When a Node's set function is being invoked, the `this` object contains a few helpful properties:

| Property     | Description                         |
| ------------ | ----------------------------------- |
| props        | Vue Component props of this Node. |
| component    | Vue Component instance.             |


## Executing Graphs on the Graph Server

When you installed your server, you took note of the endpoint beginning with `ANY - https://`.  This is where your graphs can be executed from.  Where you see `<root>` below is where you would put your HTTP server.

    ANY - https://4bc4u834549.execute-api.us-east-1.amazonaws.com/dev/{proxy+}

Your graph URL goes where you see {proxy+}

_Note: In production `/dev/` is not present at the end of the `ANY` URL._

You can execute graphs on the server by subscribing events to the lambda "DefaultRoute" in this project.  By default, all unbound HTTP traffic to the domain will come to the graph route.  What graph gets executed is based on the URL.

    <root>/<graph.url>.<graph.Node[].url>


    Example:
    The following URL would run Node "html" on graph "home"

    https://mysite.com/home.html

Graphs are stored by their URL.  Once the graph is looked up, the scheduler is invoked with the matching Node's URL.

If no Node URL is specified, the Node URL "index" is assumed.  Similarity, if no graph URL is specified, the graph "index" is assumed.  That makes the default route to the server "/" the graph "index" and the Node "index".

When a Node's set function is being invoked, the `this` object contains a few helpful properties:

| Property     | Description                                                                              |
| ------------ | ---------------------------------------------------------------------------------------- |
| event        | The AWS request event.                                                                   |
| context      | The AWS request context.                                                                 |
| callback     | The AWS request HTTP callback.                                                           |
| AWS          | The AWS library.                                                                         |
| console      | Web socket console transmitter.  Sends log data to the client side Graph Editor IDE.     |

    // example callback
    this.callback(null, {
        statusCode: 200,
        body: "Hello World!"
    });

This is the AWS callback method passed to the lambda.  If you do not call it within 30 seconds, it will automatically be called and a timeout will be logged.  Your lambda can run for longer than 30 seconds, but API gateway requires all HTTP responses end within 30 seconds.

## Environments and Publishing

When you publish a graph, that graph becomes available in the production environment.  Changes to the graph will not take effect until you publish the graph once again.  You can still test your graph in the development environment after each change.

## Sharing Nodes and Graphs

When you publish your Node or graph, it becomes available to other users of your Graph Database.  These published versions are immutable and free of dependency issues.  Once a graph or Node is published, users of that artifact can be sure it will never change.  Past versions are listed right next to current versions and clearly labeled.

You can also share your graphs and Nodes by downloading them via links provided in the IDE and then clicking and dragging the files onto other graphs.  Unlike using published graphs and Nodes, importing this way causes the imported artifact to originate on the graph you are currently editing, where published Nodes and graphs are linked and can potentially have their data side loaded.

### Infrastructure as a Graph

Because you can share the parts of the graph, and entire hypergraphs, Plastic-IO server allows you to build your entire infrastructure using first "low level" JavaScript and then higher level graph programming, all within the multi-user [Plastic-IO IDE](https://github.com/plastic-io/graph-editor).

### Maximize Code Reuse

Because each Node and graph in Plastic-IO are implicitly modular, this makes it so you can reuse the artifacts you create in other graphs very easily.  Plastic-IO graph server provides a marketplace of graphs and Nodes for developers to choose from, safely and securely.

# Extending The Graph Editor

You can add your own components to the graph editor using the vue plugin framework.  This is the way the graph editor imports its own components.

# Change Update Sequence Diagram

    +-----------+ +------------------+ +-----------------------------+       +----------------+
    |           | |                  | |                             |       |                |
    |  Browser  | |   Local Graph    | |   Local Remote Graph Copy   |       |  Remote Graph  |
    |           | |                  | |                             |       |                |
    +-----+-----+ +--------+---------+ +-------------+---------------+       +--------+-------+
          |                |                         |                                |
          |               +++                        |                               +++
          +----Change---> | | +----Diff Calc----------------Change sent to Server--> | |
          |               | |                        |                               | |
          |               | |                       +++                              | |
          |               | |                       | |                              | |
          |               | | <----Diff Calc------+ | | <---Change Sent to Client--+ | |
          |               +++                       +++                              +++
          |                |                         |                                |
          |                |                         |                                |

# Implementing the Graph Scheduler Directly

If you use the Graph-Editor and Graph-Server together all of this is abstracted from you and you can concentrate on graph programming.  However if you want to use the scheduling engine directly, it is very easy to do.

Plastic-IO uses a number of code build and analysis tools to build and execute code held in graphs or side loaded in via registries and CDNs.  Compiled code executes through the graph scheduling engine.

To get started, a graph is built then passed to the scheduler.

`const scheduler = new Scheduler(graph, {}, {}, console);`

Next, let the scheduler know which Node to invoke first by using the Node's URL.

`scheduler.url('my-Nodes-url');`

And that's it!  The code within the graph's Nodes takes care of the rest.

You can hook into a variety of events listed in the scheduling engine documentation if you want to log or react to different events and changes that occur during the runtime of the graph.


## Going Deeper

Scheduling engine documentation: [Scheduler](https://plastic-io.github.io/plastic-io/classes/_scheduler_.scheduler.html)

# Operational Transformation

Plastic-IO uses [Operational Transformation (OT)](https://en.wikipedia.org/wiki/Operational_transformation), Event Sourcing (ES), [Command Query Resource Separation (CQRS)](https://en.wikipedia.org/wiki/Command%E2%80%93query_separation), [Blockchain](https://en.wikipedia.org/wiki/Blockchain), and [Domain Driven Design (DDD)](https://en.wikipedia.org/wiki/Domain-driven_design) for event bus, and storage patterns.  By using these patterns Plastic-IO works very much like git.  Each change creates an event that is saved into a collection of change events that is then projected into a state, all verified on a simple linked list blockchain.

DDD and ES are used to create different views using the OT events in conjunction with real time runtime ES data pushed to graph data subscribers, for example using your graph as an interactive web site.

The event bus itself is CQRS, which means all OT messages are fire and forget.  No response is sent back from the [websocket](https://en.wikipedia.org/wiki/WebSocket) based server.  Rather, interested clients subscribe to the graph's notification topic and events are pushed out to the client.

In order to maintain consistency in OT edits, a Blockchain pattern is used.  Each OT change event sent to the central server contains a cryptographic link to the previous state and the projected changed state.  This cryptographic signature ensures that, in theory, the OT event ledger can never be corrupted due to invalid state change messages.

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

The Graph Editor IDE itself is always in need of love.  Built with Typescript, Vue, Vuex, and Vuetify, the graph-editor both produces the graphs that are executed by the scheduling engine, but also renders the views built into the graphs and Nodes.  It is also responsible for displaying events that occur in the graph execution runtime environment, both on the server and the browser using web sockets.

Contributing to the graph editor is not for beginners, but there are some tickets that are easier to accomplish than others.  If you think you're up to the task check out the [issues](https://github.com/plastic-io/graph-editor/issues) page and look for the "good first time issue" tag.

## Graph Server Lambda

The [Graph Server](https://github.com/plastic-io/graph-server) is an AWS HTTP Lambda {proxy+} implementation of the graph server.  Using Operational Transformation (OT) and a publishing pipeline, the graph server lambda represents an entire micro service architecture framework.  Graphs are accessed via their registered URLs and served to the users as HTTPS APIs.  Graphs running on the graph server have full access to the AWS infrastructure and can do anything AWS allows.

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

### Run End-to-End Tests with [Cypress](https://www.cypress.io/)

```sh
npm run test:e2e:dev
```

This runs the end-to-end tests against the Vite development server.
It is much faster than the production build.

But it's still recommended to test the production build with `test:e2e` before deploying (e.g. in CI environments):

```sh
npm run build
npm run test:e2e
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```
