export default {
  name: "baseInput",
  props: ["title", "field", "type", "icon"],
  template: `
  <div class="field">
    <p class="control has-icons-left">
      <input class="input" :type="type" :placeholder="title" 
        :value="field" v-on:input="$emit('input', $event.target.value)">
      <span class="icon is-small is-left">
        <i :class="icon"></i>
      </span>
    </p>
  </div>  
  `,
};
