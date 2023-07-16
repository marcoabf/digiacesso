
axios.defaults.baseURL = 'http://localhost:3000';
//axios.defaults.baseURL = "https://digiacesso.net/";
axios.defaults.withCredentials = true;

var app = new Vue({
    el: '#app',
    data: {
      message: 'Lista de usuários:',
      dados: '',
      gps: '',
      dispositivos: '',
    },
    mounted: async function () {
      console.log("Iniciando");
      //console.log($route.query.data);
      let tmp = [];
      console.log(location.search);
      tmp = location.search.split('=');
      this.dados=tmp[1];
      console.log(this.dados);
    },
    methods: 
    {
      openDoor: async function ()  {
        console.log("Verificando...");
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((position)=>{
              this.gps = "Latitude: " + position.coords.latitude +
              "    Longitude: " + position.coords.longitude +
              " Precisão: " + position.coords.accuracy;
            });
          } else {
            this.gps = "Geolocation is not supported by this browser.";
          }
          navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: ['battery_service']
          })
          .then(device => { this.dispositivos=device.name; })
          .catch(error => { console.error(error); });
        
      }
    }
});
