//import { text } from "body-parser";
//axios.defaults.baseURL = 'http://localhost:3000';
//axios.defaults.baseURL = 'http://192.168.1.109:3000';
axios.defaults.baseURL = 'https://digiacesso.net/';
//axios.defaults.baseURL = 'http://digiacesso-net.umbler.net/';
axios.defaults.withCredentials = true;


function dtBrFormat (obj) { // formata campo data para ser visualizado pelo usuário no formato BR
  let yyyy = obj['datetime'].slice(4,8);
  let mm = obj['datetime'].slice(2,4);
  let dd = obj['datetime'].slice(0,2);
  let hh = obj['datetime'].slice(8,10);
  let mi = obj['datetime'].slice(10,12);
  let ss = obj['datetime'].slice(12,14);
  obj.dtBR = dd + '/' + mm + '/' + yyyy + ' ' + hh + ':' + mi + ':' + ss;
  return obj;
}
function stateBr (obj) { // traduz o campo state de EN para BR
  switch (obj.state) {
    case 'granted': obj.stateBR = "Liberado"; break;
    case 'blocked': obj.stateBR = "Bloqueado"; break;
    case 'doublepass': obj.stateBR = "Dupla passagem detectada!"; break;
  }
  return obj;
}

function gerarQR (text) { //gera qrcode no elemento canvas
  console.log('Gerando QRcode: ' + text);
  setTimeout(function(){ QRCode.toCanvas(document.getElementById('canvas'), text, { width: 200 }, function (error) {
    if (error) console.error(error)
  });}, 200);
}

function saveImage() // salva a imagem do qrCode na pasta local do usuário
{
  var link = document.getElementById('link');
  link.setAttribute('download', 'qrcode.png');
  link.setAttribute('href', canvas.toDataURL("image/png").replace("image/png", "image/octet-stream"));
  link.click();
}  


var pages = {
    startPage: false,
    loginPage: false,
    userPage: false,
    guestPage: false,
    addGuest: false,
    qrGuest: true,
    openDoorPage: false,
    regPage: false
};
var guests = {
    name: '',
    validity: 1,
    days: '0-6',
    hinicial: 8,
    hfinal: 18,
    lifecount: 0,
    visitor: true
};
var login = {
    username: '',
    password: ''
};

var app = new Vue({
    el: '#app',
    data: {
      message: 'Lista de usuários:',
      loading: false,
      showbtn: false,
      api: [], //dados do usuário
      ctrl: [],
      access: [], //registros de entrada e saída
      myguests: [], //nome dos visitantes cadastrados
      doorSelected: '',
      see: pages,
      guest: guests,
      act1: ' is-active',
      login: login
    },
    mounted: async function () {
      console.log("Iniciando");
      //this.see.loginPage=true;
      this.loading = true;
      const response = await axios.post('/auth');
      console.log (response.data);
      if (typeof response.data === 'string') {
        this.see.loginPage=true;
      } 
      else { 
        this.api = response.data[0]; 
        this.ctrl = response.data;
        this.see.loginPage = false;
        this.see.userPage = true;
        this.login.password = '';
        this.showbtn = true;
      }
      this.loading = false;
    },
    filters:
    {
      date2br: function (value, days, format) {
        value = value.split(".");
        var newdate = moment(value[0], "YYYY-MM-DDTHH:mm:ss");
        if (days > 0) {
          days = days / (60*60*24);
          newdate = moment(newdate).add(days, 'days');
        }
        if (format=='dt') {
          return moment(newdate).format("DD/MM/YYYY");  
        } else {
        return moment(newdate).format("DD/MM/YYYY  HH:mm:ss");
        }
      }
    },
    methods: 
    {
      seeOne: function (page) {
          this.loading = false;
          for (values in this.see) {
            this.see[values] = false
          }
          this.see[page] = true; 
      },
      subscribe: function () { //web push notification
          notifyMe();
      },
      testSubs: async function () { // ask for a test notification
        const response = await axios.get('/sendtestnotification');
        console.log(response.data);
      },
      showQR: function (qr) {
        //mostra qrcode
        this.see.qrGuest = true;
        gerarQR(qr);
        window.location.hash = '#qrguest'; // get focus on canvas id
      },
      loginCheck: async function () {
          const response = await axios.post('/auth', {username: this.login.username, password: this.login.password});
          console.log (response.data);
          if (typeof response.data === 'string') {
            alert(response.data);
          } 
          else { 
            this.api = response.data[0]; 
            console.log(this.api);
            this.ctrl = response.data;
            //this.controllers = response.data;
            this.see.loginPage = false;
            this.see.userPage = true;
            this.login.password = '';
            this.showbtn = true;
          }
      },
      doLogout: async function () { 
          const response = await axios.get('/dologout');
          this.api = [];
          this.seeOne('loginPage');
          this.showbtn = false;
      },
      mountGuests: async function () {
        //busca tabela do banco de dados
        this.seeOne('guestPage');
        this.loading = true;
        const response = await axios.post('/guests', {userID: this.api.id, limit:25}); //limit => num máximo de registros
        console.log(response.data);
        this.myguests=response.data;
        this.loading = false;
      },
      addGuest: async function () {
        const response = await axios.post('/addguest', {
          name: this.guest.name,
          validity: this.guest.validity,
          days: this.guest.days,
          hinicial: this.guest.hinicial,
          hfinal: this.guest.hfinal,
          visitor: this.guest.visitor,
          lifecount: this.guest.lifecount,
          responsible: this.api.id, // id do usuário será o responsible do novo usuário
          condoid: this.api.condoid,
          type: 5, // 5=> visitante 6=> prestador de serviços
          notifytype: 1 // 0- Ninguem 1- Apenas o Responsável 2- Toda casa 3- Todo condomínio
        });
        if (response.data == 'error') { alert('Erro ao cadastrar. Tente Novamente!')} 
        else{
          alert("Dados Cadastrados!");
          console.log(response.data);
          this.showQR(response.data);
          this.see.addGuest=false;
          this.mountGuests();
        }
      },
      delGuest: async function (qr) {
        const response = await axios.post('/delguest', {qrcode: qr}); //limit => num máximo de registros
        console.log(response.data);
        if (typeof response.data === "string") {
          alert(response.data);
        }
        this.mountGuests();
      },
      openDoor: async function () { // gera requisição para abrir a porta
        console.log(this.doorSelected);
        const response = await axios.post('/open', {ctrlID: this.doorSelected});
          console.log (response.data);
          if (typeof response.data === 'string') {
            alert(response.data);
          } 
      },
      regStart: async function () { // carrega página de registros de acesso
        this.seeOne('regPage');
        this.loading = true;
        console.log(this.api.id);
        const response = await axios.post('/access', {userID: this.api.id});
        mAccess=response.data;
        if (typeof response.data === "string") {
          alert(response.data);
        } else if (typeof response.data === "object"){
          mAccess=_.map(mAccess, function(value, key){ 
            return dtBrFormat(value);
          });
          mAccess=_.map(mAccess, function (value) {
            return stateBr(value);
          });
          this.access = response.data;
        } // end else if
        console.log (response.data);
        this.loading = false;
      },
      userType: function (id) { //converte em texto o tipo de usuário
        let text;
        switch (id) {
          case 0: text="Inativo"; break;
          case 1: text="Administrador"; break;
          case 2: text="Síndico"; break;
          case 3: text="Morador Administrador"; break;
          case 4: text="Morador"; break;
          case 5: text="Visitante"; break;
          case 6: text="Prestador de Serviço"; break;
        }
        return text;
      }
    }
  });

  async function notifyMe() { //verifica se o navegador é compatível
    alert('verificando');
    if (!('serviceWorker' in navigator)) {
      console.log('Service worker não é suportado por esse navegador!'); 
      alert('Service worker não é suportado por esse navegador!');
      return;
    } else { console.log('Service worker é suportado!');}
    
    if (!('PushManager' in window)) {
      console.log('Push não é suportado');  // disable or hide UI.
      alert('Push não é suportado');
      return;
    } else {  console.log('Push é suportado');}
  
    // Let's check if the browser supports notifications
    if (!("Notification" in window)) {
      console.log("Esse navegador não suporta notificação");
      alert('O navegador não aceita notificação!');
    }
    // Let's check whether notification permissions have alredy been granted
    else if (Notification.permission === "granted") {
      // If it's okay let's create a notification
      console.log("Esse navegador suporta notificação!");
      console.log(Notification.permission);
      var notification = new Notification("Olá! Notificação teste!");
    }
    // Otherwise, we need to ask the user for permission
    else if (Notification.permission !== 'denied' || Notification.permission === "default") {
      Notification.requestPermission(function (permission) {
        // If the user accepts, let's create a notification
        if (permission === "granted") {
          var notification = new Notification("Olá! Primeira notificação!");
        }
      });
    }
    alert(Notification.permission);
    //subscriptionObject = json.stringify(subscribeUserToPush());
    const subscriptionObject = await subscribeUserToPush();
    sendSubscriptionToNode(subscriptionObject);
  }
  
  function subscribeUserToPush() { // solicitando inscrição pelo navegador
    return navigator.serviceWorker.register('/da-sw.js')
    .then(function(registration) {
      pkey = urlBase64ToUint8Array('BMQhKi9b9wgTSELzr1dKaGtIcv1wXGH9TZuZ6I9s7OCLGCPlZrsBczpB2rasO6TCbDqvxh8hnzPOGu4C');
      const subscribeOptions = {
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array('BMQhKi9b9wgTSELzr1dKaGtIcv1wXGH9TZuZ6I9s7OCLGCPlZrsBczpB2rasO6TCbDqvxh8hnzPOGu4C-IM7oXw')
      };
      return registration.pushManager.subscribe(subscribeOptions);
    })
    .then(function(pushSubscription) {
      console.log('Received PushSubscription: ', JSON.stringify(pushSubscription));
      return pushSubscription;
    });
  }

  async function sendSubscriptionToNode(subscription) { // enviando inscrição para o node
    console.log("post: "+JSON.stringify(subscription));
    const response = await axios.post('/webpush', subscription);
    console.log(response.data.success);
    if (response.data.success==true){alert("Inscrição cadastrada com sucesso!");}
  }
  
  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
   
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
   
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }


  