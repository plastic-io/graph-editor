<template>
  <span v-if="serverMode && state" class="no-graph-target">
    <v-badge :content="client!.unread" :model-value="client!.unread > 0" color="primary">
      <v-btn icon="mdi-message-text-outline" variant="text" size="x-small" aria-label="Open chat" title="Chat" @click="open"/>
    </v-badge>
    <Teleport to="body">
    <v-navigation-drawer v-model="state.visible" location="right" :width="440" temporary :scrim="false" class="chat-drawer no-graph-target">
      <section class="chat-shell" @keydown.stop @keyup.stop @mousedown.stop @mouseup.stop @mousemove.stop @wheel.stop @click.stop @copy.stop @cut.stop @paste.stop>
        <div class="chat-header">
          <strong>Chat</strong><v-spacer/>
          <v-chip size="small" :color="state.peerId ? 'primary' : undefined">{{ state.peerId ? 'Private' : graphId ? 'Graph room' : 'Private inbox' }}</v-chip>
          <v-btn icon="mdi-close" variant="text" size="small" aria-label="Close chat" @click="close"/>
        </div>
        <div class="chat-controls">
          <p v-if="state.me" class="text-caption mb-2">Your handle: <strong>@{{ state.me.handle }}</strong></p>
          <v-select :model-value="state.peerId" :items="conversations" label="Conversation" density="compact" hide-details @update:model-value="select"/>
          <v-autocomplete v-model="newPeer" :items="people" item-title="title" item-value="id" label="Message a person (@handle)" density="compact" hide-details class="mt-2" @update:model-value="openDirect"/>
          <p class="text-caption mt-2">{{ state.peerId ? 'Only these two accounts can read this conversation.' : graphId ? 'Shared with people and agents who can access this graph. Use @here to address the room.' : 'Choose a person to start a private conversation.' }}</p>
          <v-alert v-if="state.error" type="warning" density="compact" variant="tonal" class="mt-2">{{ state.error }}</v-alert>
        </div>
        <div ref="timeline" class="chat-timeline" role="log" aria-label="Chat messages" aria-live="polite" aria-relevant="additions">
          <v-btn v-if="hasOlder" size="small" variant="text" :loading="olderBusy" @click="loadOlder">Load older messages</v-btn>
          <p v-if="!messages.length" class="text-medium-emphasis text-body-2 pa-3">{{ state.peerId || graphId ? 'No messages yet. Start the conversation.' : 'Private messages are available here and inside a graph.' }}</p>
          <article v-for="message in messages" :key="message.id" :class="['chat-message', {'chat-interrupt': message.interrupt}]">
            <div class="chat-byline"><strong>{{ message.sender.name }}</strong><span>{{ message.sender.role === 'agent' ? 'Agent · ' + message.sender.id.slice(-8) : 'Person' }}</span><time :datetime="message.at" :title="message.at">{{ time(message.at) }}</time></div>
            <div v-if="message.interrupt || message.phase !== 'message'" class="mb-1">
              <v-chip v-if="message.interrupt" color="warning" size="x-small">Interruption requested</v-chip>
              <v-chip v-if="message.phase !== 'message'" size="x-small" class="ml-1">{{ message.phase }}</v-chip>
            </div>
            <p>{{ message.text }}</p>
          </article>
        </div>
        <form class="chat-compose" @submit.prevent="send">
          <p v-if="mentionTarget && mentionTarget.id !== state.peerId" class="text-caption text-primary mb-2">Private message to @{{ mentionTarget.handle }}. It will not appear in the graph room.</p>
          <v-textarea v-model="draft" :disabled="sending" label="Message" placeholder="@here for the room, or @handle for a private message" rows="2" auto-grow :max-rows="5" :counter="2048" :error-messages="bytes > 2048 ? 'Keep the message within 2048 UTF-8 bytes.' : []" @keydown.ctrl.enter.prevent="send" @keydown.meta.enter.prevent="send"/>
          <div v-if="suggestions.length" class="chat-mentions" aria-label="Mention suggestions">
            <v-btn v-for="person in suggestions" :key="person.id" size="small" variant="text" @click="mention(person)">@{{ person.handle }}</v-btn>
          </div>
          <div class="d-flex align-center">
            <v-checkbox v-model="interrupt" label="Interrupt agents" density="compact" hide-details/>
            <v-btn type="submit" color="primary" :loading="sending" :disabled="!draft.trim() || bytes > 2048 || (!graphId && !state.peerId && !mentionTarget)">Send</v-btn>
          </div>
          <p class="text-caption text-medium-emphasis">Interruptions require an agent reply before its next graph action. Listening agents can react sooner.</p>
        </form>
      </section>
    </v-navigation-drawer>
    <v-snackbar v-model="notificationVisible" :timeout="8000">
      New private message from {{ state.notification?.name }}
      <template #actions><v-btn variant="text" @click="openNotification">Read</v-btn></template>
    </v-snackbar>
    </Teleport>
  </span>
</template>
<script setup lang="ts">
import {computed, nextTick, ref, watch} from 'vue';
import {useStore as useOrchestratorStore} from '@plastic-io/graph-editor-vue3-orchestrator';
import {useStore as useGraphStore} from '@plastic-io/graph-editor-vue3-graph';
import {useStore as usePreferencesStore} from '@plastic-io/graph-editor-vue3-preferences-provider';
import {useChatStore} from './store';
import {recipientFor, type Person} from './client';
const props = defineProps<{inGraph?: boolean}>();
const orchestrator = useOrchestratorStore(), graph = useGraphStore(), preferences = usePreferencesStore(), store = useChatStore();
const client = computed(() => store.client);
const state = computed(() => client.value?.state);
const serverMode = computed(() => !preferences.preferences.useLocalStorage && !!preferences.preferences.graphWSSServer);
const graphId = computed(() => props.inGraph ? graph.graphSnapshot?.id || '' : '');
watch(() => serverMode.value ? orchestrator.dataProviders.graph : null, socket => store.attach(socket), {immediate:true});
watch([client, graphId], ([c, id]) => {if (c) void c.setGraph(id);}, {immediate:true});
const draft = ref(''), interrupt = ref(false), sending = ref(false), olderBusy = ref(false), newPeer = ref<string | null>(null);
const timeline = ref<HTMLElement | null>(null), notificationVisible = ref(false);
let retryId = '', retryPayload = '';
const bytes = computed(() => new TextEncoder().encode(draft.value).length);
const messages = computed(() => (state.value?.peerId ? state.value.directMessages : state.value?.graphMessages) || []);
const hasOlder = computed(() => state.value?.peerId ? state.value.directHasOlder : state.value?.graphHasOlder);
const people = computed(() => (state.value?.people || []).map(p => ({...p, title:`@${p.handle} — ${p.name}${p.online ? ' · online' : ''}`})));
const conversations = computed(() => [
  ...(graphId.value ? [{title:`Graph room${state.value?.unreadGraph ? ' (' + state.value.unreadGraph + ')' : ''}`, value:''}] : []),
  ...(state.value?.threads || []).map(t => ({title:`@${t.peer.handle}${state.value?.unreadDirect[t.peer.id] ? ' (' + state.value.unreadDirect[t.peer.id] + ')' : ''}`, value:t.peer.id})),
]);
const mentionTarget = computed(() => {try {return recipientFor(draft.value, state.value?.people || []);} catch {return undefined;}});
const suggestions = computed(() => {
  const match = /(?:^|\s)@([a-zA-Z0-9_-]*)$/.exec(draft.value);
  return match ? (state.value?.people || []).filter(p => p.handle.startsWith(match[1].toLowerCase())).slice(0, 5) : [];
});
function mention(person: Person) {draft.value = draft.value.replace(/@([a-zA-Z0-9_-]*)$/, `@${person.handle} `);}
function time(at: string) {return new Date(at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});}
async function scrollEnd() {await nextTick(); timeline.value?.scrollTo({top:timeline.value.scrollHeight});}
function close() {if (state.value) state.value.visible = false;}
function open() {if (state.value) {state.value.visible = true; client.value!.markRead(); void client.value!.refresh(); void scrollEnd();}}
async function select(id: string) {await client.value?.select(id || ''); void scrollEnd();}
async function openDirect(id: string | null) {if (!id || !state.value) return; state.value.visible = true; await select(id); newPeer.value = null;}
async function openNotification() {const id = state.value?.notification?.id; if (id) await openDirect(id); notificationVisible.value = false;}
async function loadOlder() {olderBusy.value = true; try {await client.value?.older();} catch (e: any) {if (state.value) state.value.error = e.message;} finally {olderBusy.value = false;}}
async function send() {
  if (!state.value || !client.value || sending.value || !draft.value.trim() || bytes.value > 2048) return;
  const payload = JSON.stringify([graphId.value, state.value.peerId, draft.value, interrupt.value]);
  if (payload !== retryPayload) {retryPayload = payload; retryId = crypto.randomUUID();}
  sending.value = true; state.value.error = '';
  try {await client.value.post(retryId, draft.value, interrupt.value); draft.value = ''; interrupt.value = false; retryPayload = ''; await scrollEnd();}
  catch (e: any) {state.value.error = e.message;}
  finally {sending.value = false;}
}
watch(() => [graphId.value, state.value?.peerId], () => {if (!sending.value) {draft.value = ''; interrupt.value = false; retryPayload = '';}});
watch(() => state.value?.notification, value => {notificationVisible.value = !!value;});
watch(() => messages.value[messages.value.length - 1]?.id, () => {
  if (state.value?.visible) {client.value?.markRead(); const el = timeline.value; if (!el || el.scrollHeight - el.scrollTop - el.clientHeight < 150) void scrollEnd();}
});
</script>
<style scoped>
.chat-drawer {max-width: 100vw; z-index: 1005 !important; text-transform: none; white-space: normal;}
.chat-shell {height: 100%; display: flex; flex-direction: column; min-height: 0;}
.chat-header {display: flex; align-items: center; gap: .5rem; padding: .5rem 1rem; border-bottom: 1px solid rgba(127,127,127,.25);}
.chat-controls {padding: .75rem 1rem; flex-shrink: 0;}
.chat-timeline {flex: 1; min-height: 80px; overflow-y: auto; padding: .25rem 1rem; overscroll-behavior: contain;}
.chat-message {margin: .5rem 0; padding: .7rem; background: rgba(127,127,127,.1); border-radius: .5rem; border-left: 3px solid transparent;}
.chat-interrupt {border-left-color: rgb(var(--v-theme-warning));}
.chat-byline {display: flex; flex-wrap: wrap; align-items: baseline; gap: .4rem; font-size: .75rem; margin-bottom: .35rem;}
.chat-byline strong {font-size: .85rem; overflow-wrap: anywhere;}
.chat-byline time {margin-left: auto; opacity: .65;}
.chat-message p {white-space: pre-wrap; overflow-wrap: anywhere; font-size: .9rem; user-select: text;}
.chat-compose {flex-shrink: 0; padding: .75rem 1rem; border-top: 1px solid rgba(127,127,127,.25);}
.chat-mentions {max-height: 90px; overflow-y: auto;}
@media (max-height: 650px) {.chat-controls {max-height: 155px; overflow-y: auto;} .chat-compose {max-height: 230px; overflow-y: auto;}}
</style>
