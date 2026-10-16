<template>
  <v-menu v-model="open" location="top" :close-on-content-click="false">
    <template #activator="{props}">
      <v-btn v-bind="props" data-testid="ai-permissions" size="small" variant="text"
        :color="permissions.mode === 'fully-automatic' ? 'warning' : permissions.mode === 'safe-actions' ? 'primary' : undefined"
        :prepend-icon="selected.icon" append-icon="mdi-chevron-down" :disabled="!graphId">
        AI Permissions <span class="ai-mode">{{ selected.label }}</span>
      </v-btn>
    </template>
    <v-card class="ai-permissions-menu" data-testid="ai-permissions-menu" @click.stop @mousemove.stop>
      <div class="ai-heading">AI Permissions<span>This graph · this session</span></div>
      <v-list role="menu" density="compact" class="py-1">
        <v-list-item v-for="option in options" :key="option.value" role="menuitemradio"
          :aria-checked="permissions.mode === option.value" :active="permissions.mode === option.value"
          :data-testid="'ai-mode-' + option.value" :title="option.label" :subtitle="option.description"
          :prepend-icon="option.icon" @click="choose(option.value)">
          <template #append><v-icon v-if="permissions.mode === option.value" size="18" icon="mdi-check"/></template>
        </v-list-item>
      </v-list>
      <div class="ai-footer">Stack deletion is never allowed by these modes. Removal, replacement and data-loss reviews stay manual. Resets to Manual on reload or graph change.</div>
      <v-alert v-if="permissions.stoppedReason" density="compact" type="warning" variant="tonal" class="ma-2">Automation stopped: {{ permissions.stoppedReason }}</v-alert>
    </v-card>
  </v-menu>
  <v-dialog v-model="warningOpen" max-width="520">
    <v-card class="ai-permissions-warning" data-testid="ai-permissions-warning">
      <v-card-title>Enable {{ pendingLabel }}?</v-card-title>
      <v-card-text>
        <v-alert density="compact" type="warning" variant="tonal" class="mb-3">Eligible pending and new reviews will be approved as you while this editor is open. This can create billable resources<span v-if="pending === 'fully-automatic'">, run changed code and change IAM permissions</span>.</v-alert>
        <p v-if="pending === 'safe-actions'">Names, descriptions and layout can be accepted automatically. Infrastructure is limited to new retained buckets, tables, queues and log groups without access-policy changes. Resource-changing recovery stays manual.</p>
        <p v-else>Validated graph proposals and eligible infrastructure reviews can be approved automatically. Code and connections may change; supported recovery can run without another confirmation.</p>
        <p class="mt-3">Stack deletion is never allowed by this setting. Resource removals, replacements, rollback actions and data-loss recovery stay manual. Server authorization and exact-digest checks still apply.</p>
        <p class="mt-3 text-caption">Only this graph in this editor session. Switching to Manual stops new approvals; it does not cancel work already approved. Existing agent delegations are separate.</p>
      </v-card-text>
      <v-card-actions><v-btn @click="warningOpen=false">Cancel</v-btn><v-spacer/><v-btn color="warning" variant="flat" @click="confirm">Enable {{ pendingLabel }}</v-btn></v-card-actions>
    </v-card>
  </v-dialog>
</template>
<script lang="ts">
import {defineComponent} from 'vue';
import {aiPermissionModes,useAiPermissions,type AiPermissionMode} from '@plastic-io/graph-editor-vue3-graph';
export default defineComponent({
  name:'ai-permissions-menu',
  props:{graphId:{type:String,required:true}},
  data:()=>({open:false,warningOpen:false,pending:'safe-actions' as AiPermissionMode,pendingGraph:'',options:aiPermissionModes}),
  computed:{
    permissions:()=>useAiPermissions(),
    selected(){return aiPermissionModes.find(option=>option.value===this.permissions.mode)!;},
    pendingLabel(){return aiPermissionModes.find(option=>option.value===this.pending)!.label;},
  },
  watch:{graphId:{immediate:true,handler(graphId:string){this.permissions.bindGraph(graphId);this.warningOpen=false;this.open=false;}}},
  beforeUnmount(){this.permissions.stop();},
  methods:{
    choose(mode:AiPermissionMode){
      this.open=false;
      if(mode==='manual'){this.permissions.setMode(mode);return;}
      if(mode===this.permissions.mode)return;
      this.pending=mode;this.pendingGraph=this.graphId;this.warningOpen=true;
    },
    confirm(){
      if(this.warningOpen&&this.pendingGraph===this.graphId&&this.graphId)this.permissions.setMode(this.pending);
      this.warningOpen=false;
    },
  },
});
</script>
<style scoped>
.ai-permissions-menu,.ai-permissions-warning{background:rgb(var(--v-theme-surface))!important;color:rgb(var(--v-theme-on-surface));border:1px solid rgba(var(--v-theme-on-surface),.12);border-radius:8px!important}
.ai-permissions-menu :deep(.v-list){background:transparent!important;color:inherit}
.ai-permissions-menu :deep(.v-list-item-title){font-size:13px;font-weight:500}
.ai-mode{margin-left:8px;font-size:10px;opacity:.8;letter-spacing:.02em}
.ai-permissions-menu{width:370px;max-width:calc(100vw - 24px)}
.ai-heading{padding:12px 16px 8px;font-size:14px;font-weight:600;display:flex;align-items:center;justify-content:space-between;gap:12px}
.ai-heading span{font-size:11px;font-weight:400;opacity:.65}
.ai-permissions-menu :deep(.v-list-item-subtitle){white-space:normal;-webkit-line-clamp:3;line-height:1.4;font-size:12px}
.ai-permissions-menu :deep(.v-list-item){padding-top:9px;padding-bottom:9px}
.ai-footer{padding:10px 16px 12px;border-top:1px solid rgba(var(--v-theme-on-surface),.12);font-size:11px;line-height:1.5;opacity:.7}
</style>
