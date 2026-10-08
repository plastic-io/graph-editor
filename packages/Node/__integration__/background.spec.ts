import {it,expect} from 'vitest';
import {defineComponent,h,nextTick,onMounted,onUnmounted} from 'vue';
import {mount} from '@vue/test-utils';
import Node from '../Node.vue';
it('the real node render keeps a hidden background listener mounted through presentation',async()=>{
 let mounts=0,unmounts=0;
 const Listener=defineComponent({setup(){onMounted(()=>mounts++);onUnmounted(()=>unmounts++);return()=>h('span','listener');}});
 const source:any=Node;
 const Harness=defineComponent({render:source.render,props:{node:{default:()=>({id:'n'})},presentation:Boolean,graph:Object,hostNode:Object},components:{NodeComponent:Listener,NodeEditor:{render:()=>null},NodeField:{render:()=>null}},
  data:()=>({localNode:{id:'n',properties:{appearsInPresentation:false,runInBackground:true}},loaded:true,broken:false,scheduler:{state:{}},inputs:[],outputs:[],styles:[],mouse:{lmb:false},translating:false,component:{},nodeProps:{},renderVersion:0,localHoveredNode:null,editorStyle:{},nodeStyle:{},currentGraph:{},isLinked:false,errorMessage:''}),
  computed:{visible:source.computed.visible,mountedForExecution:source.computed.mountedForExecution},methods:{mountError(){},dataChange(){},set(){}}});
 const wrapper=mount(Harness,{global:{stubs:{'v-card':true,'v-icon':true,'v-card-title':true}}});expect(mounts).toBe(1);
 await wrapper.setProps({presentation:true});expect(wrapper.isVisible()).toBe(false);expect(unmounts).toBe(0);
 (wrapper.vm as any).localNode.properties.runInBackground=false;await nextTick();expect(unmounts).toBe(1);
 await wrapper.setProps({presentation:false});expect(mounts).toBe(2);
 wrapper.unmount();expect(unmounts).toBe(2);
});
