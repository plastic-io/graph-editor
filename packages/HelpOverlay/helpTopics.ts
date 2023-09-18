export default {
    settingsNewNodeHelp: {
        title: "New Node Help",
        html: "When this is switched on, creating a new node will use the help template which contains helpful information about nodes for new users.  When off, new nodes are bare bones."
    },
    openGraph: {
        title: "Graph Manager",
        html: `Opens the Graph Manager in another window.
Graph Manager allows you to create, open, delete and download graphs stored on your browser and on the internet.`
    },
    deleteSelected: {
        title: "Delete Selected",
        html: "Deletes the currently selected nodes and connectors.<br>Keyboard Shortcut DELETE",
    },
    documentName: {
        title: "Document Name",
        html: "Name of the document.  This is the name that appears in the graph manager.  This name will also be used if this graph is published."
    },
    plastic: {
        title: "   ",
        html: `
        <v-card>
            <div style="text-align: center;">
                <img style="width: 75px;" src="https://avatars1.githubusercontent.com/u/60668496?s=200&v=4"/>
                <br>
                <a style="color: white;" href="https://github.com/plastic-io">Plastic-io</a>
                <br>
                Visual Programming Language
            </div>
            <div style="text-align: center;">
                Copyright &copy; 2020, plastic-io<br>
                All rights reserved<br>
            </div>
        </v-card>`
    },
    undo: {
        title: "Undo",
        html: "Undoes the last action.<br>Keyboard Shortcut CTRL/CMD + Z"
    },
    redo: {
        title: "redo",
        html: "Redoes the last action.<br>Keyboard Shortcut CTRL/CMD + SHIFT + Z"
    },
    duplicate: {
        title: "Duplicate",
        html: "Duplicates the selected nodes and connectors<br>Keyboard Shortcut CTRL/CMD + SHIFT + D"
    },
    group: {
        title: "Group",
        html: "Groups the selected nodes<br>Keyboard Shortcut CTRL/CMD + G"
    },
    ungroup: {
        title: "Ungroup",
        html: "Ungroups the selected nodes<br>Keyboard Shortcut CTRL/CMD + SHIFT + G"
    },
    bringForward: {
        title: "Bring Forward",
        html: "Brings the selected nodes forward one layer<br>Keyboard Shortcut CTRL/CMD + ]"
    },
    bringToFront: {
        title: "Bring To Front",
        html: "Brings the selected nodes to the front of the stack<br>Keyboard Shortcut CTRL/CMD + SHIFT + ]"
    },
    sendBackward: {
        title: "Send Backward",
        html: "Sends the selected nodes back one layer<br>Keyboard Shortcut CTRL/CMD + ["
    },
    sendToBack: {
        title: "Send To Back",
        html: "Sends the selected nodes to the back of the stack<br>Keyboard Shortcut CTRL/CMD + SHIFT + ["
    },
    toggleHelp: {
        title: "Toggle Help",
        html: "Toggles this help overlay"
    },
    nodeProperties: {
        title: "Node Properties",
        html: "Properties for the primary selected node.  Only one node can be altered at a time.  The first node you click on, even when in a group, is the primary selected node."
    },
    set: {
        title: "Node Set Function",
        html: `
<div style="height: 70vh; overflow: auto;padding: 7px;border: solid 1px rgba(0, 0, 0, 0.3);background: rgba(0, 0, 0, 0.1);border-radius: 5px;">
    <p>Set runs when data flows into one of the edges of your node.  This happens either when someone runs <i>scheduler.url("this-node's-url")</i>,
    or when another node's edge is connected to this node and data is passed through.</p>
    <p>When recieving data on an edge, the set function will run, pay attention to the scoped values <i>field</i> and <i>value</i>.
        <i>field</i> is the name of the edge on this node data is being passed in on, while <i>value</i> is the data being passed in.</p>
    <p>While the set function is executing, to pass data out of an edge, type <i>edges[outputName] = val;</i>.</p>
    <p>There is no limit to the number of edges or number of times you can set an edge value.  Each time you set a value, it will cause a distinct data flow event.</p>
    <p>Data can flow from edge to edge over time, there is no time limit.  However the domain in which you are executing might have a time limit, for example, lambda time limit is typically 5 minutes.</p>
    <h4>Scoped Variables</h4>
    <p>
        <table class="help-overlay-table">
            <tr>
                <th>Name</th>
                <th>Description</th>
            </tr>
            <tr>
                <td>
                    edges
                </td>
                <td>
                    These edge outputs are defined in the designer.  E.x.: edges.x = "foo" sends "foo" out of the x edge.
                    Setting edges is how data flows through the graph.
                </td>
            </tr>
            <tr>
                <td>state</td>
                <td>Scheduler state.  Use this shared object to track your application state during execution.</td>
            </tr>
            <tr>
                <td>field</td>
                <td>The name of the input edge trigged by the remote node edge.</td>
            </tr>
            <tr>
                <td>value</td>
                <td>The value passed to the field.</td>
            </tr>
            <tr>
                <td>node</td>
                <td>The node instance, contains many of the other fields.</td>
            </tr>
            <tr>
                <td>cache</td>
                <td>Node specific runtime cache object.  Stick what you want here, it's yours, but it goes away when runtime is over.</td>
            </tr>
            <tr>
                <td>graph</td>
                <td>The entire graph.</td>
            </tr>
            <tr>
                <td>data</td>
                <td>Node specific data.  This data persists between runs.  Requires graph modification to change.
                If your domain does not allow for writes to the graph, you cannot modify this data in the set function.</td>
            </tr>
        </table>
    </p>
    <h4>Browser Context Variables</h4>
    <p>
        <table class="help-overlay-table">
            <tr>
                <th>Name</th>
                <th>Description</th>
            </tr>
            <tr>
                <td>
                    this.component
                </td>
                <td>
                    The Vue component instance.
                </td>
            </tr>
            <tr>
                <td>
                    this.props
                </td>
                <td>
                    Mutable reactive props of the component.
                </td>
            </tr>
        </table>
    </p>
    <h4>Server Context Variables</h4>
    <p>
        <table class="help-overlay-table">
            <tr>
                <th>Name</th>
                <th>Description</th>
            </tr>
            <tr>
                <td>
                    this.event
                </td>
                <td>
                    The AWS event.
                </td>
            </tr>
            <tr>
                <td>
                    this.context
                </td>
                <td>
                    The AWS event context.
                </td>
            </tr>
            <tr>
                <td>
                    this.callback(err, response)
                </td>
                <td>
                    The AWS request callback.
                    <pre>
// example callback
this.callback(null, {
    statusCode: 200,
    body: "Hello World!"
});
                    </pre>
                </td>
            </tr>
            <tr>
                <td>
                    this.console.(log|error|warn|info|debug)
                </td>
                <td>
                    Web socket console transmitter. Sends log data to the client side Graph Editor IDE.
                </td>
            </tr>
            <tr>
                <td>
                    this.AWS
                </td>
                <td>
                    The AWS library.
                </td>
            </tr>
        </table>
    </p>
    <h4>When Does this run?</h4>
    <p>The node set function is what runs when another node's edge connector outputs to this node.</p>
    <p>The set function also gets invoked when this node is executed via <i>scheduler.url(nodeUrl)</i>.</p>
    <h4>What can it do?</h4>
    <p>The set function runs in the context that the graph was instantiated in.  This means if the graph was instantiated on the browser, the context of the graph will be the browser.
    You only have access to the functionality in the context the graph was instantiated in.
    This means if your graph was instantiated on the server, you cannot do things on the browser, and vice versa.</p>
</div>
        `
    },
    template: {
        title: "Vue Single File Component",
        html: `
<div style="height: 70vh; overflow: auto;padding: 7px;border: solid 1px rgba(0, 0, 0, 0.3);background: rgba(0, 0, 0, 0.1);border-radius: 5px;">
    <p>
        When in the Graph IDE, each node is represented by a Vue Single File Component.  This component can observe and manipulate the <i>node</i>, <i>state</i>, and <i>scheduler</i>.
    </p>
    <h4>Props</h4>
    <table class="help-overlay-table">
        <tr>
            <td>node</td>
            <td>The current node.  You can alter the <i>data</i> property of the node.  If your node is in a writeable environment, changes will be persisted onto the graph. See <a href="https://plastic-io.github.io/plastic-io/modules/_node_.html">Node</a></td>
        </tr>
        <tr>
            <td>state</td>
            <td>Runtime state.  This is an empty object until it is manipulated by a node.  Initial state can also be manipulated externally (off graph) by the scheduler.</td>
        </tr>
        <tr>
            <td>scheduler</td>
            <td>Graph execution scheduler.  You can observe events, manipulate state, or invoke nodes via URL. E.g.: Invoke the current node: <i>scheduler.url(node.url)</i>.  See <a href="https://plastic-io.github.io/plastic-io/classes/_scheduler_.scheduler.html">Scheduler</a></td>
        </tr>
    </table>
    <h4>Scheduler Events</h4>
    <p>Attach to these events using <i>scheduler.addEventListener(event, proc)</i></p>
    <table class="help-overlay-table">
        <tr>
            <td>beginedge</td>
            <td>When an edge is about to be invoked</td>
        </tr>

        <tr>
            <td>endedge</td>
            <td>When an edge is finished invoking</td>
        </tr>

        <tr>
            <td>error</td>
            <td>When an error occurs</td>
        </tr>

        <tr>
            <td>set</td>
            <td>When a set function is run</td>
        </tr>

        <tr>
            <td>begin</td>
            <td>When the scheduler starts to run</td>
        </tr>

        <tr>
            <td>end</td>
            <td>When the scheduler is done running</td>
        </tr>

        <tr>
            <td>warning</td>
            <td>When a warning occurs</td>
        </tr>

        <tr>
            <td>load</td>
            <td>When a remote resourse is loaded</td>
        </tr>
    </table>
</div>
        `
    },
    edge: {
        title: "Node Edges",
        html: `
<p>Each node can can zero or more input and/or output edges.  Data always flow from left to right.</p>
<h4>Names</h4>
<p>Input and output edges are named.  Within your <i>set</i> function at runtime, you can send data to outputs using <i>edges[outputName] = val</i>.</p>
<h4>Types</h4>
<p>Connectors are typed by matching string names to other string names in the "type" field.  The Object type can connect to any other type.  All other types strictly connect to matching types.
<h4>External</h4>
<p>When an input or output is marked "external" that means it will appear as an input or output in the graph when it is published.
<h4>Tests</h4>
<p>Each input can have a number of tests to exercise the code to ensure it works correctly.  You can create and run the tests here.  You can also run all tests from the node properties panel.
`
    },
    executeSelectedNode: {
        title: "Execute Selected Node",
        html: "This will invoke <i>Scheduler.url(selectedNode.url)</i> with the value set in <i>preferences > test</i> value as if the node was a graph entry point."
    },
    graphProperties: {
        title: "Graph Properties",
        html: "Properties of current graph.  From here you can see all the graph properties, nodes, publishing and more."
    },
    log: {
        title: "Log and State",
        html: "Here you can see information gathered at runtime as well as see the state of your application."
    },
    history: {
        title: "History",
        html: "Undo/Redo history"
    },
    library: {
        title: "Library",
        html: "Browse local and public node libraries."
    },
    settings: {
        title: "Graph IDE Settings",
        html: "Change the settings of the IDE"
    },
    dragResizePanel: {
        title: "Panel Resizer",
        html: "Change the size of the control panel with this grabber."
    },
    "node-edge": {
        title: "Node Edge",
        html: "The connection sockets between nodes"
    },
    nodeInstance: {
        title: "Node Instance",
        html: "An instance of a node"
    },
    mouseCoordinates: {
        title: "Mouse Coordinates",
        html: "The current location of the mouse on the graph"
    },
    selectionCoordinates: {
        title: "Selection Coordinates",
        html: "The location and size of the selection box."
    },
    selectedNodes: {
        title: "Selected/Total Nodes",
        html: "Count of selected/total nodes on the graph."
    },
    viewportLocation: {
        title: "Viewport Location",
        html: "Where on the graph you're at.  You can move the viewpoint around with the middle mouse button, or by holding down the space bar and clicking and dragging the mouse.  Click the numbers to reset to x: 0, y: 0."
    },
    viewportZoom: {
        title: "Viewport Zoom Level",
        html: "The current zoom level.  Click + to zoom in - to zoom out.  Click the number to reset to x: 100%.<br>Keyboard Shortcut CTRL/CMD + + and CTRL/CMD +"
    },
    toggleLabels: {
        title: "Toggle Labels",
        html: "Toggle input/output labels on and off"
    },
    toggleGrid: {
        title: "Toggle Grid",
        html: "Toggle the grid background on and off"
    },
    toggleLock: {
        title: "Toggle Lock",
        html: "Lock node movement.  This allows you to manipulate controls on the node without inadvertently moving it."
    },
    togglePresentation: {
        title: "Toggle Presentation",
        html: "Toggles presentation mode on and off.<br>  Keyboard Shortcut ALT + ` (the key above tab)",
    },
    node: {
        title: "node",
        html: `Nodes are the building blocks of the graph.  Nodes are built in the graph designer.  Nodes can also be published and used in other graphs.  When you publish a graph you can import it into another graph as a encapsulated node.
        <a href="https://plastic-io.github.io/plastic-io/modules/_node_.html">Node</a>`
    },
    nodeName: {
        title: "Node Name",
        html: "Name of the node.  When published, this will show up in the list of published nodes."
    },
    nodeDescription: {
        title: "Node Description",
        html: "Description of the node.  When published, this will show up in the list of published nodes."
    },
    nodeUrl: {
        title: "Node URL",
        html: "The URL of the node.  Running a graph happens when a node's URL is specified in the <i>Scheduler.url(nodeUrl)</i> function."
    },
    nodeIcon: {
        title: "Node Icon",
        html: "The icon that shows up next to the node when it is published."
    },
    nodeAppearsInExportedGraph: {
        title: "Node Appears In Published Graph",
        html: "When checked, the node's Vue component will appear in the published graph.  Even when not checked, the node's set function will still be available."
    },
    nodeLocation: {
        title: "Node Location",
        html: "The location of the node on the graph."
    },
    nodePresentationLocation: {
        title: "Node Presentation",
        html: "The location of the node when in presentation mode."
    },
    nodeData: {
        title: "Node Data",
        html: "Data saved on the node by the Vue Template, Set function, or Node designer."
    },
    nodePublish: {
        title: "Publish",
        html: "Clicking publish will publish your node locally.  Once published locally you can reuse your node on other graphs, and/or upload it to a public registry."
    },
    nodeTags: {
        title: "Tags",
        html: "Help categorize and filter your nodes.  It can help to add the domain your node executes in.  Add your own tags or use tags, or reuse popular ones."
    },
    nodeTests: {
        title: "Node Tests",
        html: "Create tests to exercise your code and ensure your node works."
    },
    setTemplate: {
        title: "setTemplate",
        html: "$set"
    },
    vueTemplate: {
        title: "vueTemplate",
        html: "$template"
    },
    outputs: {
        title: "Outputs",
        html: "Output ports."
    },
    inputs: {
        title: "Inputs",
        html: "Input ports."
    },
    ioOrder: {
        title: "Port Order",
        html: "The order in which the ports appear on the node."
    },
    ioIdentity: {
        title: "Identity",
        html: "The name and type of the port, as well as export flag."
    },
    ioConnections: {
        title: "Connections",
        html: "List of connections made to this port."
    },
    ioTests: {
        title: "Tests",
        html: "Tests associated with this input."
    },
    "inputs-name": {
        title: "Name",
        html: "Name of this input."
    },
    "inputs-type": {
        title: "Type",
        html: "Type of this input."
    },
    "inputs-external": {
        title: "External",
        html: "When true, this input will appear on the published graph."
    },
    "outputs-name": {
        title: "Name",
        html: "Name of this output"
    },
    "outputs-type": {
        title: "Type",
        html: "Type of this output."
    },
    "outputs-external": {
        title: "External",
        html: "When true, this output will appear on the published graph."
    },
    connectorOrder: {
        title: "Connector Order",
        html: "The order in which the connectors are invoked on the node output."
    },
    graph: {
        title: "Graph Properties",
        html: "Properties of the graph."
    },
    graphName: {
        title: "Graph Name",
        html: "Name of the graph.  This name will appear in the Graph Manager and published lists."
    },
    graphDescription: {
        title: "Graph Description",
        html: "Description of the graph.  This description will appear in the Graph Manager and published lists."
    },
    graphId: {
        title: "Graph ID",
        html: "The unique UUIDv4 of the graph generated when the graph was created."
    },
    graphIcon: {
        title: "Graph icon.",
        html: "This icon will appear in the Graph Manager and published lists."
    },
    graphVersion: {
        title: "Graph event source Version",
        html: `<p>Each time a change is made to the graph, the version increases by 1.</p>
        <p>Graph data is event sourced.  This means the graph data is not stored as state but rather a list of events.  Event sourcing provides a number of features.</p>
        <ul>
            <li>Versioning</li>
            <li>State rewind and fast-forward</li>
            <li>Event idempotency</li>
            <li>Small, asyncronous updates</li>
            <li>Multi user</li>
            <li>Eventual consistency</li>
        </ul>
        `
    },
    graphPresentation: {
        title: "Presentation",
        html: "Here, you can toggle having presentation mode turn on automatically when the graph loads.  You can set the height and width of the graph during presentation.  This data can be passed to internal nodes."
    },
    graphMeta: {
        title: "Graph meta data",
        html: "Meta data about the graph you can set."
    },
    graphNodeList: {
        title: "Graph Node List",
        html: "List of nodes on the graph.  You can select nodes from here."
    },
    graphPublishButton: {
        title: "Graph Publish Button",
        html: "Clicking here will publish the graph"
    },
    graphTags: {
        title: "Graph Tags",
        html: "Help categorize and filter your graphs.  It can help to add the domain your graph executes in.  Add your own tags or use tags, or reuse popular ones."
    },
    graphIOList: {
        title: "External Input Output List",
        html: "This is a list of inputs and outputs that are flagged exportable."
    },
    logs: {
        title: "Logs and State",
        html: "Here you can find execution logs and scheduler state."
    },
    logState: {
        title: "State",
        html: "The scheduler state."
    },
    logErrors: {
        title: "Errors",
        html: "Errors logged during scheduler execution."
    },
    logWarnings: {
        title: "Warnings",
        html: "Warnings logged during scheduler execution."
    },
    logInfo: {
        title: "Info",
        html: "Info messages logged during scheduler execution."
    },
    logStateRefresh: {
        title: "State Refresh",
        html: "Click here to force a refresh of the state view."
    },
    logClear: {
        title: "Clear Log",
        html: "Clear the log"
    },
    historyPanel: {
        title: "History Panel",
        html: "Session history"
    },
    importPanel: {
        title: "Node Library",
        html: "Collection of local and public nodes"
    },
    importLocal: {
        title: "Local Nodes",
        html: "Nodes you've created and imported."
    },
    importPublic: {
        title: "Public Nodes",
        html: "Nodes in public registries"
    },
    importLocalSearch: {
        title: "Local Search",
        html: "Search your local collection of published nodes and graphs."
    },
    importLocalList: {
        title: "Local list",
        html: "List of your published nodes and graphs."
    },
    importPublicRegistryList: {
        title: "Registry List",
        html: "List of public registries."
    },
    importPublicTopLevel: {
        title: "Node categories",
        html: "This is the top level of node categories of the repository."
    },
    importPublicSecondLevel: {
        title: "Node subcategories",
        html: "Public Nodes."
    },
    importPublicList: {
        title: "Public Nodes",
        html: "List of public nodes."
    },
    settingsGridSize: {
        title: "Grid size",
        html: "The size of the grid."
    },
    settingsSnapToGrid: {
        title: "Snap to grid",
        html: "When on, nodes will snap to the grid when moved."
    },
    settingsShowGrid: {
        title: "Show grid",
        html: "When on, the grid is visible."
    },
    settingsShowLabels: {
        title: "Show labels",
        html: "When on, node input and output labels are always visible."
    },
    settingsDebug: {
        title: "Debug",
        html: "When on, additional detailed information in collected at runtime.  This will incur a performance penalty when turned on because a large amount of data is collected and stored in memory."
    },
    showConnectorView: {
        title: "Show Connector Info",
        html: "Toggle runtime connector info display on and off."
    },
    nodeId: {
        title: "Node ID",
        html: "The UUIDv4 of the node.  This uniquely identifies the node."
    },
    graphUrl: {
        title: "Graph URL",
        html: "URL of the graph.  This value sets what endpoint this graph controls."
    },
} as any;
export const template = `<template>
    <v-card style="width: 500px;" class="pa-2">
        <v-card-title>
            You just created a new node
        </v-card-title>
        <v-card-subtitle>
            <ul>
                <li>
                    Nodes are edited directly in the graph.
                </li>
                <li>
                    Hover over this node and click the
                    <v-icon>mdi-vuejs</v-icon>
                    icon.
                </li>
                <li>
                    From the editor you can change this message.
                </li>
                <li>
                    Click <v-icon>mdi-vector-point</v-icon> to add named edges to connect nodes.
                </li>
                <li>
                    Click <v-icon>mdi-lambda</v-icon> to program edge behavior.
                </li>
            </ul>
        </v-card-subtitle>
        <v-card-text class="pa-2">
            
            Properties for this node
            <v-spacer class="pa-2"></v-spacer>
            Check out this source of this button to see how to invoke the node
            <v-btn class="ma-2" @click="buttonClick">
                <v-icon>
                    mdi-play
                </v-icon>
                Example invocation
            </v-btn>
            <v-spacer class="pa-2"></v-spacer>
            To stop this tutorial node from appearing each time you create a new blank node
            click on <v-icon>mdi-cogs</v-icon> and under "Graph" select: turn off "Show Help Messages".
        </v-card-text>
    </v-card>
</template>
<script>
export default {
    methods: {
      buttonClick() {
        this.$emit("set", \`Hello World from node $\{this.node.id}\`);
      },
    },
    props: {
        node: Object,
        state: Object,
    }
}
</script>
<style>
</style>
`;
export const set = `console.info(value);`;

