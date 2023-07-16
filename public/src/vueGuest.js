
import baseTable from "../components/baseTable.js";
import baseInput from "../components/baseInput.js";
import labelEditable from "../components/labelEditable.js";
import Vue from "vue";


const QRCode = require("qrcode");
const moment = require("moment");
//var fs = require("fs");
const axios = require("axios").default;

axios.defaults.withCredentials = true;
axios.defaults.baseURL = "http://localhost:3000";
//axios.defaults.baseURL = "http://192.168.43.228:3001";
axios.defaults.baseURL = "http://192.168.0.253:3000";
axios.defaults.baseURL = "https://www.iacesso.com.br";
//axios.defaults.baseURL = 'http://5.183.8.175:3000';


Vue.component("baseTable", baseTable);
Vue.component("my-input", baseInput);
Vue.component("field-edt", labelEditable);

function dtBrFormat(obj) {
  // formata campo data para ser visualizado pelo usuário no formato BR
  // let yy = obj["datetime"].slice(6, 8);
  // let mm = obj["datetime"].slice(2, 4);
  // let dd = obj["datetime"].slice(0, 2);
  // let hh = obj["datetime"].slice(8, 10);
  // let mi = obj["datetime"].slice(10, 12);
  // let ss = obj["datetime"].slice(12, 14)
  //obj.dtBR = dd + "/" + mm + "/" + yy + " " + hh + ":" + mi + ":" + ss;
  obj.dtBR = moment(obj["datetime"]).format("DD/MM/YYYY HH:mm:ss");
  return obj;
}
function stateBr(obj) {
  // traduz o campo state de EN para BR
  switch (obj.state) {
    case "granted":
      obj.stateBR = "Liberado";
      break;
    case "blocked":
      obj.stateBR = "Bloqueado";
      break;
    case "doublepass":
      obj.stateBR = "Dupla passagem detectada!";
      break;
  }
  return obj;
}

function gerarQR(text) {
  //gera qrcode no elemento canvas
  console.log("Gerando QRcode: " + text);
  setTimeout(function () {
    QRCode.toCanvas(document.getElementById("canvas"), text, { width: 300 }, function (error) {
      if (error) console.error(error);
    });
  }, 200);
}

function saveImage() {
  // salva a imagem do qrCode na pasta local do usuário
  var link = document.getElementById("link-qr-code");
  link.setAttribute("download", "qrcode.png");
  link.setAttribute("href", canvas.toDataURL("image/png").replace("image/png", "image/octet-stream"));
  //link.click();
}

var pages = {
  startPage: false,
  qrGuest: false,
  openDoorPage: false,
  about: false,
  loadingPage: false,
  menuModal: false,
};

var guest = {
  name: "",
};

var app = new Vue({
  el: "#app",
  data: {
    message: "Lista de usuários:",
    loading: false,
    showbtn: false,
    see: pages,
    api: [], //dados do usuário
    ctrl: [],
    doorSelected: 0,
    guest: guest,
  },
  mounted: async function () {
    console.log("Iniciando");
    this.loading = true;
    let atualizar = false;

    let qrcode = window.location.search.slice(4)
    // pega itens armazenados no navegador
    this.guest.name = localStorage.getItem("name") ? localStorage.getItem("name") : ""
    this.guest.phone = localStorage.getItem("phone") ? localStorage.getItem("phone") : ""
    if (localStorage.getItem("qrcode") && localStorage.get("qrcode") != qrcode) atualizar = true;
    if (!localStorage.getItem("qrcode")) atualizar = true;
    if (atualizar) {
      //busca dados do visitante
      const response = await axios.post("/loadguest", {
        qrcode: qrcode,
      });
      console.log(typeof (response.data));
      if (typeof (response.data == "object")) { //se retorna dados
        this.guest = {
          id: response.data[0].id,
          name: response.data[0].firstname,
          phone: response.data[0].cellphone,
          condoId: response.data[0].condoId,
          condoName: response.data[0].condoName,
          perm: response.data[0].perm,
          responsible: response.data[0].responsible,
          type: response.data[0].type
        }
        this.ctrl = response.data;
        localStorage.setItem("guest", JSON.stringify(this.guest))
        localStorage.setItem("ctrl", JSON.stringify(this.ctrl))
        //console.log(this.guest)
      } else alert(response.data);
    } else {
      this.guest = JSON.parse(localStorage.getItem('guest'))
      this.ctrl = JSON.parse(localStorage.getItem('ctrl'))
    }
    this.loading = false;
  },
  filters: {
    date2br: function (value, days, format) {
      value = value.split(".");
      var newdate = moment(value[0], "YYYY-MM-DDTHH:mm:ss");
      if (days > 0) {
        days = days / (60 * 60 * 24);
        newdate = moment(newdate).add(days, "days");
      }
      if (format == "dt") {
        return moment(newdate).format("DD/MM/YY");
      } else {
        return moment(newdate).format("DD/MM/YY  HH:mm:ss");
      }
    },
    permissao: function (value) {
      let saida = "";
      if (value != null) {
        value = value.split(" ");
        if (value[0].length < 4) {
          saida = diaDaSemana(value[0].charAt(0));
          if (saida != diaDaSemana(value[0].charAt(2))) saida += " a " + diaDaSemana(value[0].charAt(2));
          saida += " " + value[1];
        }
      }
      return saida;
    },
  },
  methods: {

    recData: function () {
      localStorage.setItem('name', this.guest.name);
      localStorage.setItem('phone', this.guest.phone);
    },
    tela: function () {
      return window.matchMedia("(min-width: 599px)").matches; // <600 (true) mobile // >600 (false) desktop
    },

    loadQrcode: async function () {
      //carrega o qrcode a partir da porta escolhida
      let ctrlId = this.doorSelected
      console.log(ctrlId)
      let ctrlOne = this.ctrl.filter((obj) => { return obj.ctrlid == ctrlId })
      if (ctrlOne.length > 0) {
        if (ctrlOne[0].brand.toLowerCase() == 'utech')
          this.showQR(ctrlOne[0].qrcode)
        if (ctrlOne[0].brand.toLowerCase() == 'accontrol') {
          console.log("qrdinamico");
          const response = await axios.post("/qrdinamico", {
            userID: this.guest.id,
            controllerId: this.doorSelected
          });
          console.log(response.data.slice(-1))
          if (response.data.slice(-1) != "!") {
            this.see.qrGuest = true;
            gerarQR(response.data)
          }
          else (alert(response.data))
        }
      }
    },

    seeOne: function (page) {
      this.loading = false;
      if (this.see.regPage == false) this.regLimit = 0;
      for (let values in this.see) {
        this.see[values] = false;
      }
      this.see[page] = true;
      //console.log(document.getElementById('menuPos').offsetLeft)
    },

    showQR: function (qr) {
      //mostra qrcode
      this.see.qrGuest = true;
      gerarQR(qr);
    },

    userPage: function () {
      markBtn(0); // muda a cor do botão para indicar qual é a pagina atual
      this.seeOne("userPage"); // habilita a página do usuário
      this.getUserPhoto();
    },

    userType: function (id) {
      //converte em texto o tipo de usuário
      let text;
      switch (id) {
        case 0:
          text = "Inativo";
          break;
        case 1:
          text = "Administrador";
          break;
        case 2:
          text = "Síndico";
          break;
        case 3:
          text = "Morador Administrador";
          break;
        case 4:
          text = "Morador";
          break;
        case 5:
          text = "Visitante";
          break;
        case 6:
          text = "Prestador de Serviço";
          break;
      }
      return text;
    },
    sendTTest: async function () {
      var response = await axios.post("/sendTTest", {
        msg: "Mensagem de teste do iAcesso!",
      });
    }
  },
});

function diaDaSemana(value) {
  let saida;
  switch (value) {
    case "0":
      saida = "Dom";
      break;
    case "1":
      saida = "Seg";
      break;
    case "2":
      saida = "Ter";
      break;
    case "3":
      saida = "Qua";
      break;
    case "4":
      saida = "Qui";
      break;
    case "5":
      saida = "Sex";
      break;
    case "6":
      saida = "Sab";
      break;
  }
  return saida;
}
