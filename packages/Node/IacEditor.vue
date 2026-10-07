<template>
  <div class="no-graph-target" @mousedown.stop @click.stop>
    <v-card v-if="loading" width="420" class="pa-3"><v-progress-linear indeterminate/>Loading CloudFormation template…</v-card>
    <v-alert v-if="message" type="error" class="iac-editor-message" density="compact" closable @click:close="message = ''">{{ message }}</v-alert>
    <monaco-code-editor v-if="loaded" ref="code" :key="generation"
      :title="readOnly ? 'CloudFormation · generated template (read only)' : 'CloudFormation · ' + (resource ? 'resource JSON' : 'template')"
      :node-id="nodeId" :graph-id="graphSnapshot.id" :template-type="'iac-' + graphSnapshot.id" :language="language"
      :value="value" :read-only="readOnly" :allow-popout="false" :errors="[]"
      help-link="https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/template-formats.html"
      @save="save" @close="$emit('close')"/>
  </div>
</template>
<script lang="ts">
import {mapActions,mapState} from 'pinia';
import {useStore as useGraphStore} from '@plastic-io/graph-editor-vue3-graph';
import {useStore as useOrchestratorStore} from '@plastic-io/graph-editor-vue3-orchestrator';
export default {
  name:'iac-editor',props:{nodeId:{type:String,required:true}},emits:['close'],
  data(){return {loading:false,loaded:false,message:'',value:'',baseValue:'',language:'yaml',readOnly:false,generation:0};},
  computed:{
    ...mapState(useGraphStore,['graphSnapshot']),
    node():any{return this.graphSnapshot?.nodes.find((n:any)=>n.id===this.nodeId);},
    resource():boolean{return !!this.node?.properties?.iac?.resource && !this.node?.properties?.iac?.stack;},
  },
  mounted(){this.load();},
  methods:{
    ...mapActions(useGraphStore,['updateNodeProperties']),
    async load(){
      this.loading=true;this.message='';
      try {
        const iac=this.node?.properties?.iac;
        if(!iac)throw new Error('This node no longer has CloudFormation data.');
        if(this.resource){this.language='json';this.value=JSON.stringify(iac.resource,null,2);}
        else {
          const provider=(useOrchestratorStore() as any).syncProviders.find((p:any)=>typeof p.stackTemplate==='function');
          const result=provider ? await provider.stackTemplate(this.graphSnapshot.id,this.nodeId) : null;
          this.readOnly=result?.source==='graph';
          this.language=result?.format || iac.template?.format || 'yaml';
          this.value=this.readOnly ? result.text : iac.template?.text || result?.text || '';
          if(!result && !iac.template?.text)throw new Error('Connect to the graph server to view the generated template.');
        }
        this.baseValue=this.value;this.loaded=true;this.generation++;
      } catch(e:any){this.message=e.message || String(e);}
      this.loading=false;
    },
    save(value:string){
      if(this.readOnly)return;
      try {
        const node=this.node;if(!node)throw new Error('This node was removed.');
        const iac=node.properties.iac;
        const current=this.resource ? JSON.stringify(iac.resource,null,2) : iac.template?.text || '';
        if(current!==this.baseValue && current!==value)throw new Error('This CloudFormation data changed in another session. Copy your draft, reopen the editor, and merge the changes before saving.');
        const next={...iac};
        if(this.resource){const resource=JSON.parse(value);if(!resource || typeof resource!=='object' || Array.isArray(resource) || typeof resource.type!=='string')throw new Error('A resource needs a CloudFormation type and properties.');next.resource=resource;}
        else next.template={...iac.template,format:this.language,text:value};
        this.updateNodeProperties({nodeId:this.nodeId,properties:{...node.properties,iac:next}});
        this.value=value;this.baseValue=this.resource ? JSON.stringify(next.resource,null,2) : value;this.message='';
      }catch(e:any){
        this.message=e.message || String(e);
        // Keep a rejected draft available even though the generic editor emitted Save.
        const code=this.$refs.code as any;if(code){code.dirty=true;localStorage.setItem(code.storeKey,value);}
      }
    },
  },
};
</script>
<style scoped>.iac-editor-message { position:absolute; top:-90px; width:700px; z-index:5; }</style>
