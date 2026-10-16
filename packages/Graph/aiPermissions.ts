import {defineStore} from 'pinia';

export type AiPermissionMode = 'manual' | 'safe-actions' | 'fully-automatic';
export const aiPermissionModes = [
  {value:'manual' as AiPermissionMode,label:'Manual',icon:'mdi-account-check-outline',description:'Review each graph proposal, deployment and recovery.'},
  {value:'safe-actions' as AiPermissionMode,label:'Safe Actions',icon:'mdi-shield-check-outline',description:'Approve names and layout, plus retained storage additions without access-policy changes.'},
  {value:'fully-automatic' as AiPermissionMode,label:'Fully Automatic',icon:'mdi-lightning-bolt-outline',description:'Also approve code, connections, eligible infrastructure updates and recovery.'},
];

/** Deliberately session-only, separate from graph content and agent delegations. */
export const useAiPermissions = defineStore('ai-permissions', {
  state:()=>({graphId:'',mode:'manual' as AiPermissionMode,generation:0,stoppedReason:''}),
  actions:{
    bindGraph(graphId:string){
      if(this.graphId===graphId)return;
      this.graphId=graphId;
      this.setMode('manual');
    },
    setMode(mode:AiPermissionMode){
      if(!this.graphId||!aiPermissionModes.some(option=>option.value===mode))mode='manual';
      this.mode=mode;this.generation++;this.stoppedReason='';
    },
    stop(reason=''){
      this.setMode('manual');this.stoppedReason=reason;
    },
    current(graphId:string,generation:number){return !!graphId&&this.graphId===graphId&&this.generation===generation&&this.mode!=='manual';},
  },
});
