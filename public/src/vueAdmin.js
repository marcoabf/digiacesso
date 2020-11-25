const _ = require("underscore");
const axios = require("axios").default;
axios.defaults.withCredentials = true;
//axios.defaults.baseURL = "http://localhost:3000";
//axios.defaults.baseURL = "http://192.168.0.253:3000";
axios.defaults.baseURL = "https://digiacesso.net/";

import baseTable from "../components/baseTable.js";
import baseInput from "../components/baseInput.js";
import labelEditable from "../components/labelEditable.js";
import { NULL } from "mysql2/lib/constants/types";
Vue.component("baseTable", baseTable);
Vue.component("my-input", baseInput);
Vue.component("field-edt", labelEditable);

var login = {
  username: "",
  password: "",
};

var pages = {
  startPage: false,
  loginPage: false,
  userPage: false,
  condosPage: false,
  condoData: false,
  equipNav: false,
  newUser: false,
};
var nUser = {
  //novo usuário
  firstname: "",
  lastname: "",
  username: "",
  password: "",
  email: "",
  cellphone: "",
  type: 4,
  unit: "",
  condoid: 0,
};
var userType = [
  { index: 0, name: "Inativo" },
  { index: 1, name: "Administrador/Síndico" },
  { index: 2, name: "Porteiro/Zelador" },
  { index: 3, name: "Ocupante Master" },
  { index: 4, name: "Ocupante" },
];

var app = new Vue({
  el: "#app",
  data: {
    loading: false,
    showbtn: false,
    api: [], //dados do usuário
    newUser: nUser,
    userType: userType,
    condos: [],
    unitUsers: [],
    units: [],
    equipments: [],
    userBool: [],
    see: pages,
    act1: " is-active",
    regLimit: 0,
    login: login,
    condoSelected: "",
    theCondoId: 0,
    ctrl2read: 0,
    ctrlCode: "",
    tokenTelegram: '1140456861:AAHHhjj7mi0ZlWDTQLEIwPa7rgoRUOo22gU',
  },
  mounted: async function () {
    console.log("Iniciando");
    this.loading = true;
    const response = await axios.post("/authadmin");
    console.log(response.data);
    if (typeof response.data === "string") {
      // usuário não está logado
      this.see.loginPage = true;
    } else {
      this.api = response.data[0];
      this.condos = response.data;
      this.see.loginPage = false;
      this.see.userPage = true;
      this.login.password = "";
      this.showbtn = true;
    }
    this.loading = false;
  },
  filters: {
    adminType: function (id) {
      let text;
      switch (id) {
        case 0:
          text = "Administrador Master";
          break;
        case 1:
          text = "Administrador";
          break;
        case 2:
          text = "Operador";
          break;
        case 3:
          text = "Técnico";
          break;
      }
      return text;
    },
  },
  methods: {
    getTelegramUpdates: async function () {
      console.log('Getting...');
      const response = await axios.get("https://api.telegram.org/bot1140456861:AAHHhjj7mi0ZlWDTQLEIwPa7rgoRUOo22gU/getUpdates", {withCredentials: false});
      console.log(response.data);
      console.log('end get');
    },
    userTypeChanged: function () {
      console.log(this.newUser);
    },
    getCode: async function () {
      const response = await axios.post("/getcode", {
        ctrlId: ctrl2read,
      });
      this.ctrlCode = response.data;
    },
    turnVisib: function (userid) {
      //deixa div visivel
      let id = "user" + userid;
      let alvo = document.getElementById(id);
      alvo.style.display = "block";
    },
    seeOne: function (page) {
      this.loading = false;
      if (this.see.regPage == false) this.regLimit = 0;
      for (let values in this.see) {
        this.see[values] = false;
      }
      this.see[page] = true;
    },
    condoLoad: async function () {
      //busca dados do condominio e carrega página
      console.log(this.condoSelected);
      this.see.condoData = true;
      this.theCondoId = Number(document.getElementById("condo-index").selectedIndex);
      console.log(this.theCondoId);
      //busca todas as unidades dos condomínios
      if ((this.condoSelected != "0") & (this.condoSelected != NULL)) {
        console.log("buscando...");
        const response = await axios.post("/condounits", {
          condoId: this.condoSelected,
        });
        this.unitUsers = _.each(response.data, (element) => {
          return (element.password = "");
        });
        this.unitUsers = _.groupBy(this.unitUsers, (obj) => {
          return obj.unit;
        });
        this.units = _.initial(Object.getOwnPropertyNames(this.unitUsers));
        console.log(this.unitUsers);
        // console.log(this.units);
        const response2 = await axios.post("/condoctrls", {
          condoId: this.condoSelected,
        });
        this.equipments = response2.data;
      }
    },
    loginAdminCheck: async function () {
      const response = await axios.post("/authadmin", {
        username: this.login.username,
        password: this.login.password,
      });
      console.log(response.data);
      if (typeof response.data === "string") {
        // tipo string é mensagem de erro
        alert(response.data);
      } else {
        this.api = response.data[0];
        this.condos = response.data;
        console.log(this.api);
        this.see.loginPage = false;
        this.see.userPage = true;
        this.login.password = "";
        this.showbtn = true;
      }
    },
    doLogout: async function () {
      // do logout
      const response = await axios.get("/dologout");
      this.api = [];
      this.seeOne("loginPage");
      this.showbtn = false;
    },
  },
});
