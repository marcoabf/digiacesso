//import { text } from "body-parser";

axios.defaults.baseURL = 'http://192.168.1.110:3000';
axios.defaults.baseURL = 'https://digiacesso.net/';
//axios.defaults.baseURL = 'http://digiacesso-net.umbler.net/';
axios.defaults.withCredentials = true;

function notifying () {
    /**
     * Check Browser Notification Permission
     */
    var Notification = window.Notification || window.mozNotification || window.webkitNotification;
    Notification.requestPermission(function (permission) {
    });
    // Verificando permissão para pedido de notificação do navegador 
    function requestNotificationPermissions() 
    {
        if (Notification.permission !== 'denied') {
            Notification.requestPermission(function (permission) {
            });
        }
    }
}
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
          // em desenvolvimento
          notifying();
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
          gerarQR(response.data);
          console.log(response.data);
          this.see.addGuest=false;
          this.see.qrguest=true;
        }
      },
      delGuest: async function (qr) {
        const response = await axios.post('/delguest', {qrcode: qr}); //limit => num máximo de registros
        console.log(response.data);
        if (typeof response.data === "string") {
          alert(response.data);
        }
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

  