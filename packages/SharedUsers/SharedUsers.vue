<template>
  <span class="shared-users" v-if="users.length > 0">
    <span
      v-for="user in users"
      :key="user.key"
      class="shared-user"
      :style="{borderColor: user.color}"
      :title="user.title"
    >
      <img v-if="user.avatar" :src="user.avatar" :alt="user.name"/>
      <span v-else class="shared-user-initials" :style="{background: user.color}">
        {{user.initials}}
      </span>
    </span>
  </span>
</template>
<script lang="ts">
import {mapState} from "pinia";
import {useStore as useOrchestratorStore} from "@plastic-io/graph-editor-vue3-orchestrator";
export default {
  name: "shared-users",
  computed: {
    ...mapState(useOrchestratorStore, ["graphUsers"]),
    users() {
      const people = this.graphUsers || {};
      return Object.keys(people).map((key) => {
        const user = people[key] || {};
        const name = user.name || "Someone";
        return {
          key,
          name,
          avatar: user.avatar || "",
          color: user.color || "#888888",
          title: user.email ? `${name} (${user.email})` : name,
          initials: name.split(/\s+/).map((part: string) => part[0]).join("").slice(0, 2).toUpperCase(),
        };
      });
    },
  },
}
</script>
<style scoped>
.shared-users {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.shared-user {
  display: inline-flex;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: solid 2px;
  overflow: hidden;
  align-items: center;
  justify-content: center;
}
.shared-user img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.shared-user-initials {
  font-size: 9px;
  font-weight: bold;
  color: #fff;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
