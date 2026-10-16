<template>
  <details v-if="review" class="template-consequences" data-testid="template-consequences">
    <summary>Retention, lifecycle &amp; resource consequences <span>{{ review.resources?.length || 0 }} resources</span></summary>
    <div class="consequence-body">
      <p>The authored template is submitted unchanged. Omitted settings use AWS defaults.</p>
      <p v-if="review.baseline === 'unavailable'" role="status">The previous template is unavailable; comparison is incomplete.</p>
      <details v-for="resource in review.resources" :key="resource.logicalId" class="resource-consequence" :open="resource.requiresConfirmation">
        <summary><strong>{{ resource.logicalId }}</strong><span>{{ resource.action }}{{ resource.replacement && resource.replacement !== 'False' ? ' · replacement ' + resource.replacement : '' }}</span></summary>
        <p v-for="(message,i) in resource.consequences" :key="i">{{ message }}</p>
        <div class="settings-scroll"><table><thead><tr><th>Setting</th><th>Current</th><th>Reviewed</th></tr></thead><tbody>
          <tr v-for="setting in resource.settings" :key="setting.path" :class="{changed:setting.changed}"><td>{{ setting.path }}</td><td><pre>{{ display(setting.before) }}</pre></td><td><pre>{{ display(setting.after) }}</pre></td></tr>
        </tbody></table></div>
      </details>
    </div>
  </details>
</template>
<script lang="ts">
export default {
  name:'deployment-consequences',props:{review:{type:Object as any,default:null}},
  methods:{display(setting:any):string{return !setting?'Resource not present':setting.specified?JSON.stringify(setting.value,null,2):'Omitted — AWS default';}},
};
</script>
<style scoped>
.template-consequences{border:1px solid rgba(var(--v-theme-on-surface),.12);border-radius:6px;margin:10px 0;font-size:12px;max-width:100%}.template-consequences summary{cursor:pointer;padding:9px;overflow-wrap:anywhere}.template-consequences summary span{margin-left:9px;font-size:11px;opacity:.65}.consequence-body{padding:0 10px 10px;max-height:380px;overflow:auto}.consequence-body p{margin:6px 0;font-size:11px}.resource-consequence{border-top:1px solid rgba(var(--v-theme-on-surface),.1);margin-top:8px}.settings-scroll{max-width:100%;overflow:auto;max-height:240px}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:11px}th,td{text-align:left;vertical-align:top;padding:7px;border-bottom:1px solid rgba(var(--v-theme-on-surface),.08);overflow-wrap:anywhere}th{font-weight:500}pre{font:inherit;white-space:pre-wrap;overflow-wrap:anywhere;margin:0}.changed{background:rgba(var(--v-theme-warning),.06)}
</style>
