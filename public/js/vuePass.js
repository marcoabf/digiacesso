
axios.defaults.baseURL = 'http://localhost:3000';
axios.defaults.baseURL = "https://www.iacesso.com.br";
axios.defaults.withCredentials = true;

Vue.component('my-input', {
  props: ['title', 'field', 'type', 'icon'],
  template: '#campo-de-entrada'
});

var app = new Vue({
  el: '#app',
  data: {
    message: 'Lista de usuários:',
    dataUser: '',
    dados: '',
    newPass: []
  },
  mounted: async function () {
    console.log("Iniciando");
    //dataUser = $route.query.data;
    let tmp = [];
    console.log(location.search);
    tmp = location.search.split('=');
    this.dados = tmp[1];
    console.log(this.dados);
  },
  methods:
  {
    sendNewPass: async function () {
      console.log("Enviando requsição.");
      console.log(this.newPass[0].length)
      if (this.newPass[0] !== this.newPass[1]) alert("A nova senha não foi repetida corretamente. Digite o segundo campo novamente!");
      else if (this.newPass[0].length < 8) alert("A senha deve ter pelo menos 8 digitos!");
      else {
        console.log("Senhas conferem!");
        const response = await axios.post('/forgotpass', { data: this.dados, password: this.newPass[0] });
        console.log(response.data);
        alert(response.data);
      }
    }
  }
});
