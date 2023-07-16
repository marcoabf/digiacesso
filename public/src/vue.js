
import baseTable from "../components/baseTable.js";
import baseInput from "../components/baseInput.js";
import labelEditable from "../components/labelEditable.js";
import Vue from "vue";
import { delay, now } from "underscore";


const QRCode = require("qrcode");
const moment = require("moment");
//var fs = require("fs");
const axios = require("axios").default;

axios.defaults.withCredentials = true;
//axios.defaults.baseURL = "http://localhost:3000";
axios.defaults.baseURL = "http://192.168.0.253:3000";
//axios.defaults.baseURL = "https://www.iacesso.com.br";
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
  loginPage: false,
  userPage: false,
  guestPage: false,
  addGuest: false,
  qrGuest: false,
  qrLink: false,
  openDoorPage: false,
  regPage: false,
  passwordPage: false, // dentro da pagina de usuário
  about: false,
  loadingPage: false,
  changePassword: false, // na página de login
  menuModal: false,
};

var guests = {
  id: 0,
  name: "",
  days: "0-6",
  hinicial: 8,
  hfinal: 18,
  lifecount: 0,
  visitor: true,
};

var login = {
  username: "",
  email: "",
  password: "",
};

var app = new Vue({
  el: "#app",
  data: {
    message: "Lista de usuários:",
    loading: false,
    showbtn: false,
    newPass: [],
    api: [], //dados do usuário
    ctrl: [],
    access: [], //registros de entrada e saída
    accessList: "visitors",
    myguests: [], //nome dos visitantes cadastrados
    myguestsResults: [], //nome dos visitantes e filtrados pela busca
    doorSelected: 0,
    see: pages,
    guest: guests,
    buscaVisitantes: '',
    qrSelecionado: '',
    linkParaQr: '',
    regLimit: 0, // para aumentar o limite de registros quando
    login: login,
    nPushBtn: false,
    nTelegramBtn: false,
    showTgmBox: false,
    showCPhoto: false,
    telegramCodeVar: '',
    telegramToken: '1140456861:AAHHhjj7mi0ZlWDTQLEIwPa7rgoRUOo22gU',
  },
  mounted: async function () {
    console.log("Iniciando");
    //this.see.loginPage=true;
    this.loading = true;
    const response = await axios.post("/auth");
    console.log(response.data);
    if (typeof response.data === "string") {
      // se não retornou os dados do usuáiro
      this.see.loginPage = true;
    } else {
      this.api = response.data[0];
      let ntf = parseInt(this.api.notify).toString(2).split("").reverse().join("");
      this.api.npush = (ntf.charAt(0) == '1') ? true : false;
      this.api.nemail = (ntf.charAt(1) == '1') ? true : false;
      this.api.ntelegram = (ntf.charAt(2) == '1') ? true : false;
      //console.log(this.api);
      this.ctrl = response.data;
      this.doorSelected = response.data[0].ctrlID; // posiciona na primeira porta da aba abrir
      this.see.loginPage = false;
      this.login.password = "";
      this.showbtn = true;
      this.userPage();
    }
    this.loading = false;
  },
  filters: {
    days2date: function (value, days) {
      if (value) {
        value = value.split(".");
        let dt1, dias
        let newdate = moment(value[0]);
        if (days > 0) {
          dt1 = moment();
          newdate = moment(newdate).add(days, "days");
          dias = newdate.diff(dt1, 'days')
          if (dias < 0) dias = 0;
        } else dias = 0;
        if (dias == 1) return dias + " dia";
        else return dias + " dias";
      }
    },
    date2br: function (value, days, format) {
      if (value) {
        value = value.split(".");
        var newdate = moment(value[0], "YYYY-MM-DDTHH:mm:ss");
        if (days > 0) {
          //days = days / (60 * 60 * 24);
          newdate = moment(newdate).add(days, "days");
        }
        if (format == "dt") {
          return moment(newdate).format("DD/MM/YY");
        } else {
          return moment(newdate).format("DD/MM/YY  HH:mm:ss");
        }
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
    isUpToDate: function (value, days) {
      if (value) {
        value = value.split(".");
        let dt1, dias
        let newdate = moment(value[0]);
        if (days > 0) {
          dt1 = moment();
          newdate = moment(newdate).add(days, "days");
          dias = newdate.diff(dt1, 'days')
          if (dias < 0) dias = false; else dias = true;
        } else dias = false;
        return dias;
      }
    },
    snapshot: async function () {
      const response = await axios.get("/snapshot");
      console.log(response.data);
    },
    getUserPhoto: async function () {
      console.log('foto...')
      let url = ''
      let img = document.getElementById("user-photo")
      await fetch('https://dog.ceo/api/breeds/image/random')
        .then(res => res.json())
        .then(result => {
          console.log(result)
          url = result.message
        })
      await fetch(url)
        .then(response => response.blob())
        .then(imageBlob => {
          // Then create a local URL for that image and print it 
          const imageObjectURL = window.URL.createObjectURL(imageBlob);
          console.log(imageObjectURL);
          img.style.backgroundImage = `url('${imageObjectURL}')`
          console.log(img)
        });
    },

    showIMG: async function (dTime, id) {
      console.log('imagem da camera...')
      this.showCPhoto = true
      let url = ''
      let dTUnix = moment(dTime).format('X')
      let img2 = document.getElementById("camera-photo")
      const response = await axios.post("/getsnap", { arquivo: `${dTUnix}-${id}.jpg` }, { responseType: 'blob' });
      console.log(response)
      const imageObjectURL = window.URL.createObjectURL(response.data);
      console.log(imageObjectURL);
      img2.style.backgroundImage = `url('${imageObjectURL}')`
      console.log(img2)
      //fileDownload(response, `AET-${this.servico.id}.pdf`);

    },

    telegramCode: function () {
      this.showTgmBox = !this.showTgmBox
      // enviar api para gerar código
    },
    newTelegramCode: async function () {
      console.log("obtendo novo código")
      let codigo = ''
      const response = await axios.post("/newtelegramcode", { userId: this.api.id })
      if (response.data.slice(0, 1) == "c") {
        codigo = response.data.slice(1)
        console.log(codigo)
        this.telegramCodeVar = codigo
      }
    },
    telegramUpdate: async function () {
      console.log('Getting...');
      const response = await axios.post("/telegramUpdate", { codigo: this.telegramCodeVar, userId: this.api.id })
      alert(response.data);
      console.log('end get');
    },
    sendTelegramTest: async function () {
      console.log("Enviando teste...")
      //api para enviar mensagem teste do telegram ao usuário
      let token = this.telegramToken
      let chatId = this.api.telegram
      let telegramMsg = "Teste de envio do telegram."
      const response = await axios.post("https://api.telegram.org/bot1140456861:AAHHhjj7mi0ZlWDTQLEIwPa7rgoRUOo22gU/sendMessage", { chat_id: chatId, text: telegramMsg }, { withCredentials: false });
      console.log(response.data);
      console.log('end get');

    },
    updateNotifyers: async function () {
      let npush = (this.api.npush == true) ? '1' : '0'; //bit 1
      let nemail = (this.api.nemail == true) ? '1' : '0'; //bit 2
      let ntelegram = (this.api.ntelegram == true) ? '1' : '0'; //bit 3
      let ntf = ntelegram + nemail + npush; // juntando os bits
      let data = parseInt(ntf, 2); //transformando em decimal
      console.log(data);
      let id = this.api.id;
      const response = await axios.post("/updatefield", { tbl: 'users', fid: id, fname: 'notify', fvalue: data });
      //alert(response.data);
    },
    uploadUserPhoto() {
      console.log("Upload da photo do usuário");
    },
    tela: function () {
      return window.matchMedia("(min-width: 599px)").matches; // <600 (true) mobile // >600 (false) desktop
    },
    saveImage: function () {
      saveImage();
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
    subscribe: function () {
      //web push notification
      notifyMe();
    },
    testSubs: async function () {
      // ask for a test notification
      const response = await axios.get("/sendtestnotification");
      console.log(response.data);
    },
    showQR: function (qr) {
      //mostra qrcode
      this.see.qrGuest = true;
      gerarQR(qr);
    },
    linkQR: function (qr) {
      //mostra qrcode~
      this.qrSelecionado = qr
      this.linkParaQr = window.location.origin + "/visitante/" + this.qrSelecionado;
      this.see.qrLink = true;
    },
    copyQrLink: function () {
      //var copyText = selecao;
      let selecao = window.location.origin + "/visitante/" + this.qrSelecionado;
      let texto = `Entre no link abaixo para ter acesso: \n ${selecao}`
      navigator.clipboard
        .writeText(texto)
        .then(() => {
          alert("Texto copiado: \n" + texto);
        })
        .catch(() => {
          alert("something went wrong");
        })
    },
    loginCheck: async function () {
      // fazendo o login com usuário e senha
      //console.log(this.login);
      const response = await axios.post("/auth", {
        username: this.login.username,
        password: this.login.password,
      });
      if (typeof response.data === "string") {
        alert(response.data);
      } else {
        //login ok
        this.api = response.data[0]; // dados do usuário
        let ntf = parseInt(this.api.notify).toString(2).split("").reverse().join("");
        this.api.npush = (ntf.charAt(0) == '1') ? true : false;
        this.api.nemail = (ntf.charAt(1) == '1') ? true : false;
        this.api.ntelegram = (ntf.charAt(2) == '1') ? true : false;
        console.log(this.api);
        this.ctrl = response.data; // lista de controladoras do usuário
        this.access = [];
        this.doorSelected = response.data[0].ctrlID; // posiciona na primeira porta da aba abrir
        this.accessList = "visitors"; //retornando radio button para visitantes (pagina Registros)
        this.see.loginPage = false;
        this.login.password = "";
        this.showbtn = true;
        this.userPage();
      }
    },
    doLogout: async function () {
      // do logout
      const response = await axios.get("/dologout");
      this.api = [];
      this.seeOne("loginPage");
      this.showbtn = false;
    },
    sendMailToNewPassword: async function () {
      const response = await axios.post("/mail2newpassword", {
        email: this.login.email,
      });
      alert(response.data);
    },
    changePassword: async function () {
      //console.log("Verificando nova senha");
      if (this.newPass[0] !== this.newPass[1]) alert("As senhas nos dois campos não conferem!");
      else if (this.newPass[0].length < 8) alert("A senha deve conter pelo menos 8 digitos!");
      else {
        const response = await axios.post("/changepass", {
          password: this.newPass[0],
        });
        alert(response.data); f
        this.see.passwordPage = false;
      }
    },

    userPage: function () {
      markBtn(0); // muda a cor do botão para indicar qual é a pagina atual
      this.seeOne("userPage"); // habilita a página do usuário
      this.getUserPhoto();
    },
    mountGuests: async function () {
      // mount table with all visitors linked to actual user
      markBtn(1);
      this.seeOne("guestPage");
      this.myguestsResults.pop();
      delay(100);
      this.loading = true;
      const response = await axios.post("/guests", {
        userID: this.api.id,
        limit: 25,
      }); //limit => num máximo de registros
      this.myguests = response.data;
      this.myguestsResults = this.myguests;
      console.log(this.myguests);
      this.loading = false;
    },
    buscar: function () {
      let busca = this.buscaVisitantes.toUpperCase()
      this.myguestsResults = this.myguests.filter((obj) => {
        return obj.firstname.toUpperCase().indexOf(busca) > -1
      });
    },
    addGuest: async function () {
      // insert new user to DB and controller
      console.log("lifecount: " + this.guest.lifecount);

      //adicionando usuário
      console.log(this.guest.name.length)
      if (this.guest.name.length > 40) { this.guest.name = this.guest.name.slice(0, 40) }
      console.log(this.guest.name.length)
      const response = await axios.post("/addguest", {
        userid: this.guest.id,
        name: this.guest.name,
        days: this.guest.days,
        hinicial: this.guest.hinicial,
        hfinal: this.guest.hfinal,
        visitor: this.guest.visitor,
        lifecount: this.guest.lifecount,
        responsible: this.api.id, // id do usuário será o responsible do novo usuário
        condoid: this.api.condoid,
        unit: this.api.unit,
        type: 5, // 5=> visitante 6=> prestador de serviços
        notifytype: 1, // 0- Ninguem 1- Apenas o Responsável 2- Toda casa 3- Todo condomínio
      });
      if (response.data == "error") {
        alert("Erro ao cadastrar. Tente Novamente!");
      } else {
        alert("Dados Cadastrados!");
        console.log(response.data);
        this.showQR(response.data);
        this.see.addGuest = false;
        this.mountGuests();
      }
      if (this.guest.id > 0) //se id > 0 então: edição de usuário
      {
        // retorna ao modo Adicionar
        this.guest.id = 0;
        this.guest.name = "";
      }
    },
    editGuest: async function (id) {
      // insert new user to DB and controller
      console.log("edição")
      this.see.addGuest = true
      let alvo = this.myguestsResults.find((array) => {
        return array.id == id
      })
      console.log(alvo);
      this.guest.name = alvo.firstname;
      console.log(alvo.perm)
      let permissao = this.splitPerm(alvo.perm);
      console.log(permissao)
      this.guest.id = id
      this.guest.days = permissao.days
      this.guest.hinicial = permissao.hinicial
      this.guest.hfinal = permissao.hfinal
    },
    splitPerm: function (perm) {
      console.log('verificando permissao \n\n')
      console.log(perm)
      if (perm.slice(1, 2) == "-") {
        let pWeek = String(perm.slice(0, 3)),
          pTime = perm.slice(4).split('-'),
          pTimeStart = pTime[0].split(':'),
          pTimeEnd = pTime[1].split(':')
        console.log(`Slice: ${pWeek}\n ${pTimeStart} - ${pTimeEnd}`)
        return { 'days': `${pWeek}`, 'hinicial': pTimeStart[0], 'hfinal': pTimeEnd[0] }
      } else return false;
    },
    renewGuest: async function (id) {
      // renova tempo do visitante (guest)
      if (confirm("Tem certeza que deseja Renovar o visitante?") == true) {
        const response = await axios.post("/renewguest", { guestId: id }); //limit => num máximo de registros
        console.log(response.data);
        if (typeof response.data === "string") {
          alert(response.data);
        }
        this.mountGuests();
      }
    },
    delGuest: async function (id) {
      // delete visitor (guest)
      if (confirm("Tem certeza que deseja excluir o visitante?") == true) {
        const response = await axios.post("/delguest", { qrCode: id, condoId: this.api.condoid }); //limit => num máximo de registros
        console.log(response.data);
        if (typeof response.data === "string") {
          alert(response.data);
        }
        this.mountGuests();
      }
    },
    openPage: function () {
      markBtn(3);
      this.seeOne("openDoorPage");
    },
    openDoor: async function () {
      // send request to open specific door
      console.log(this.doorSelected);
      if (confirm("Tem certeza que deseja abrir esse acesso?") == true) {
        const response = await axios.post("/open", {
          ctrlID: this.doorSelected,
          userid: this.api.id,
          origem: "web",
        });
        console.log(response.data);
        if (typeof response.data === "string") {
          alert(response.data);
        }
      }
    },
    qrDinamico: async function () {
      console.log("qrDin");
      const response = await axios.post("/qrdinamico", {
        userID: this.api.id,
        controllerId: this.doorSelected
      });
      console.log(response.data.slice(-1))
      if (response.data.slice(-1) != "!") {
        this.see.qrGuest = true;
        gerarQR(response.data)
      }
      else (alert(response.data))
    },
    alarmOff: async function () {
      // send request to open specific door
      console.log(this.doorSelected);
      if (confirm("Desativar o alarme?") == true) {
        const response = await axios.post("/alarmoff", {
          ctrlID: this.doorSelected,
        });
        console.log(response.data);
        if (typeof response.data === "string") {
          alert(response.data);
        }
      }
    },
    regStart: async function (origin) {
      // lista de registros
      markBtn(2);
      this.seeOne("regPage");
      this.loading = true;
      console.log(this.api.id);
      console.log(origin);
      if (origin != "radio") {
        this.regLimit += 10;
      }
      console.log(this.accessList);
      if (this.accessList == "users") {
        var response = await axios.post("/accessusers", {
          condoId: this.api.condoid,
          limit: this.regLimit,
        });
      } else {
        var response = await axios.post("/access", {
          userID: this.api.id,
          limit: this.regLimit,
        });
      }

      let mAccess = response.data;
      if (typeof response.data === "string") {
        alert(response.data);
      } else if (typeof response.data === "object") {
        mAccess = _.map(mAccess, function (value, key) {
          return dtBrFormat(value);
        });
        mAccess = _.map(mAccess, function (value) {
          return stateBr(value);
        });
        this.access = response.data;
      } // end else if
      console.log(response.data);
      this.loading = false;
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

function markBtn(x) {
  var button = document.getElementsByClassName("is-success");
  //console.log(button);
  if (button.length > 0) button[0].className = button[0].className.replace(/\bis-success\b/g, "");
  let nextButton = document.getElementsByTagName("button");
  nextButton[x].classList.add("is-success");
}

async function notifyMe() {
  //verifica se o navegador é compatível

  if (navigator.userAgent.indexOf("Safari") != -1 && navigator.userAgent.indexOf("Chrome") == -1) {
    alert("Its Safari");
  }
  if (!("serviceWorker" in navigator)) {
    console.log("Service worker não é suportado por esse navegador!");
    return;
  } else {
    console.log("Service worker é suportado!");
  }

  if (!("PushManager" in window)) {
    console.log("Push não é suportado"); // disable or hide UI.
    return;
  } else {
    console.log("Push é suportado");
  }
  // Let's check if the browser supports notifications
  if (!("Notification" in window)) {
    console.log("Esse navegador não suporta notificação");
  }
  // Let's check whether notification permissions have alredy been granted
  else if (Notification.permission === "granted") {
    // If it's okay let's create a notification
    console.log("Permissão para notificação liberada!");
    // var notification = new Notification("Olá! Notificação teste!"); //incompat com chrome
  }
  // Otherwise, we need to ask the user for permission
  else if (Notification.permission !== "denied" || Notification.permission === "default") {
    Notification.requestPermission(function (permission) {
      // If the user accepts, let's create a notification
      if (permission === "granted") {
        //var notification = new Notification("Olá! Primeira notificação!"); //incompat com chrome
      }
    });
  }
  //subscriptionObject = json.stringify(subscribeUserToPush());
  if (Notification.permission === "granted") {
    const subscriptionObject = await subscribeUserToPush();
    sendSubscriptionToNode(subscriptionObject);
  }
}

function subscribeUserToPush() {
  // solicitando inscrição pelo navegador
  return navigator.serviceWorker
    .register("/da-sw.js")
    .then(function (registration) {
      //pkey = urlBase64ToUint8Array("BMQhKi9b9wgTSELzr1dKaGtIcv1wXGH9TZuZ6I9s7OCLGCPlZrsBczpB2rasO6TCbDqvxh8hnzPOGu4C");
      const subscribeOptions = {
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          "BMQhKi9b9wgTSELzr1dKaGtIcv1wXGH9TZuZ6I9s7OCLGCPlZrsBczpB2rasO6TCbDqvxh8hnzPOGu4C-IM7oXw"
        ),
      };
      return registration.pushManager.subscribe(subscribeOptions);
    })
    .then(function (pushSubscription) {
      console.log("Received PushSubscription: ", JSON.stringify(pushSubscription));
      return pushSubscription;
    });
}

async function sendSubscriptionToNode(subscription) {
  // enviando inscrição para o node
  alert("enviando");
  console.log("post: " + JSON.stringify(subscription));
  const response = await axios.post("/webpush", subscription);
  console.log(response.data.success);
  if (response.data.success == true) {
    alert("Inscrição cadastrada com sucesso!");
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
