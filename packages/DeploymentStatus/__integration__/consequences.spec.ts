import {it,expect} from 'vitest';
import {mount} from '@vue/test-utils';
import Consequences from '../DeploymentConsequences.vue';

it('distinguishes unchanged finite retention, omitted AWS defaults and explicit lifecycle consequences',()=>{
 const review={baseline:'aws-current-template',resources:[
  {logicalId:'WriterLogs',action:'Unchanged',requiresConfirmation:false,consequences:['Configured retention can expire old events.'],settings:[{path:'Properties.RetentionInDays',before:{specified:true,value:30},after:{specified:true,value:30},changed:false},{path:'DeletionPolicy',before:{specified:true,value:'Retain'},after:{specified:false},changed:true}]},
  {logicalId:'Storage',action:'Modify',replacement:'True',requiresConfirmation:true,consequences:['S3 lifecycle rules may expire objects.'],settings:[{path:'Properties.LifecycleConfiguration',before:{specified:false},after:{specified:true,value:{Rules:[{Status:'Enabled',ExpirationInDays:7}]}},changed:true}]},
 ]};
 const wrapper=mount(Consequences,{props:{review}});
 expect(wrapper.text()).toContain('submitted unchanged');expect(wrapper.text()).toContain('WriterLogs');
 expect(wrapper.text()).toContain('Unchanged');expect(wrapper.text()).toContain('30');expect(wrapper.text()).toContain('Omitted — AWS default');
 expect(wrapper.text()).toContain('Retain');expect(wrapper.text()).toContain('replacement True');expect(wrapper.text()).toContain('ExpirationInDays');
 expect(wrapper.findAll('.resource-consequence')[1].attributes()).toHaveProperty('open');
 expect(wrapper.findAll('tbody tr')[0].classes()).not.toContain('changed');
 expect(wrapper.findAll('tbody tr')[1].classes()).toContain('changed');wrapper.unmount();
});

it('reports unknown baseline and handles an old server without consequence data',()=>{
 const wrapper=mount(Consequences,{props:{review:{baseline:'unavailable',resources:[]}}});
 expect(wrapper.text()).toContain('comparison is incomplete');wrapper.unmount();
 const older=mount(Consequences);expect(older.find('[data-testid="template-consequences"]').exists()).toBe(false);older.unmount();
});
