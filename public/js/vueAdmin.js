//axios.defaults.baseURL = 'http://localhost:3000';
axios.defaults.baseURL = 'http://192.168.1.110:3000';
//axios.defaults.baseURL = 'https://digiacesso.net/';
axios.defaults.withCredentials = true;

var login = {
  username: '',
  password: ''
};

var pages = {
  startPage: false,
  loginPage: false,
  userPage: false
};

var app = new Vue({
    el: '#app',
    data: {
      loading: false,
      showbtn: false,
      api: [], //dados do usuário
      doorSelected: '',
      see: pages,
      act1: ' is-active',
      regLimit: 0,
      login: login
    },
    mounted: async function () {
      console.log("Iniciando");
      //this.see.loginPage=true;
      this.loading = true;
      const response = await axios.post('/auth');
      console.log (response.data);
      if (typeof response.data === 'string') { // usuário não está logado
        this.see.loginPage=true;
      } 
      else { 
        this.api = response.data[0]; 
        this.see.loginPage = false;
        this.see.userPage = true;
        this.login.password = '';
        this.showbtn = true;
      }
      this.loading = false;
    },
    filters:
    {
    },
    methods: 
    {
        seeOne: function (page) {
          this.loading = false;
          if (this.see.regPage==false) this.regLimit = 0;
          for (values in this.see) {
            this.see[values] = false
          }
          this.see[page] = true; 
        },
        loginAdminCheck: async function () {
          const response = await axios.post('/authAdmin', {username: this.login.username, password: this.login.password});
          console.log (response.data);
          if (typeof response.data === 'string') { // tipo string é mensagem de erro
            alert(response.data);
          } 
          else { 
            this.api = response.data[0]; 
            console.log(this.api);
            this.see.loginPage = false;
            this.see.userPage = true;
            this.login.password = '';
            this.showbtn = true;
          }
      },
    }
});