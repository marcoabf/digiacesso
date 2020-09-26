const axios = require("axios").default;
export default {
  name: "labelEditable",
  props: ["tbl", "tId", "fName", "field", "unique"],
  data: function () {
    return {
      edit: false,
      lastField: "",
    };
  },
  methods: {
    editMode: function () {
      this.edit = true;
      this.lastField = this.field;
      console.log("editando");
    },
    cancelMode: function () {
      this.field = this.lastField;
      this.edit = false;
      console.log("cancelando");
    },
    saveMode: async function () {
      this.edit = false;
      console.log(this.field);
      if (this.unique == "true") {
        console.log("este campo deve ser unico!");
        if ((await this.fieldExist(this.tbl, this.fName, this.field)) == true) {
          alert("Esse nome já existe");
          return;
        } else console.log("Esse nome pode ser utilizado.");
      }
      console.log("salvando");
      this.updateField(this.tbl, this.tId, this.fName, this.field);
    },
    fieldExist: async function (table, fname, fvalue) {
      const response = await axios.post("/fieldexist", { tbl: table, fname: fname, fvalue: fvalue });
      console.log(response.data);
      return response.data == true ? true : false;
    },
    updateField: async function (table, fieldId, fname, fvalue) {
      console.log(`table: ${table} ID: ${fieldId} - ${fname} - ${fvalue}`);
      const response = await axios.post("/updatefield", { tbl: table, fid: fieldId, fname: fname, fvalue: fvalue });
      alert(response.data);
    },
  },
  template: `
  <div>
  <label v-show="!edit" @click="editMode()"> {{ field }} </label>
  <input v-show="edit" :value="field" @keyup.enter="saveMode()" @keyup.esc="cancelMode()" @input="$emit('input', $event.target.value)" style="width: 150px;" > 
  <a @click="editMode()" v-show="!edit"> 
    <span class="icon is-small is-left has-text-success">
      &nbsp;&nbsp;&nbsp;  <i class="fas fa-edit"></i>
    </span> 
  </a>
  &nbsp; <a class="has-text-success" @click="saveMode()" v-show="edit" style="padding: 5px;"> &#10004; </a>
  &nbsp;
  <a class="has-text-danger" @click="cancelMode()" v-show="edit" style="padding: 5px;">&#10006;</a>
  </div>
`,
};
