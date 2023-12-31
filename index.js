const express = require("express");
const session = require("express-session");
require("dotenv/config");
var path = require("path");
var favicon = require("serve-favicon");
var logger = require("morgan");
var bodyParser = require("body-parser");
const cors = require("cors");
var server = require("./server");
var serverAdm = require("./serverAdm");
var port = process.env.PORT || 3000;
const app = express();

const mqtt = require('mqtt')

var options = {
  host: 'broker.hivemq.com',
  port: 1883,
  username: 'marcoabf',
  password: 'tvazul25',
}

const client = mqtt.connect(options)

client.on('connect', function () {
  client.subscribe('iacesso', function (err) {
    if (!err) {
      client.publish('iacesso', 'Node.js conectado')
    }
  })
})

client.on('error', function (error) {
  console.log(error);
});

client.on('message', function (topic, message) {
  // message is Buffer
  console.log("\nMQTT \nTópico: " + topic.toString())
  console.log("Mensagem:")
  console.log(message.toString())
  server.regMqtt(message.toString())
})


console.log("começando...");
console.log(process.env.DB_USER);

//força redirecionamento HTTPS
app.get("*", (req, res, next) => {
  if (req.headers["x-forwarded-proto"] != "https" && req.headers.host == "iacesso.com.br") {
    // checa se o header é HTTP ou HTTPS
    res.redirect("https://" + req.headers.host + req.url); // faz o redirect para HTTPS
  } else {
    next(); // segue com a sequência das rotas
  }
});
//notifyR = null, //tipo de notificação que o responsável pode receber

// POLÍTICAS CORS
var corsOptions = {
  origin: "*",
};
app.use(cors(corsOptions));

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "jade");

app.use(favicon(__dirname + "/public/img/tfavicon.png")); // Define icone da página
app.use(logger("dev"));
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
app.use(express.static(path.join(__dirname, "public"))); //define pasta 'public' como página web estática
app.use("/node_modules", express.static("node_modules")); // cria acesso ao node_modules para página estática


//var cron = require('node-cron');

//cron.schedule('0 3 * * *', () => {
//  console.log('executando sempre às 3h da manhã');
//  chama função para deletar visitantes com mais de um mês
//});

//inicializando express-session
app.use(
  session({
    secret: "ctrlgrn",
    resave: true,
    saveUninitialized: true,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7,
      //secure: false,
    }, //the last number is the maxAge in hours
  })
);

app.use("/", (req, res, next) => {
  console.log("Nova requisição recebida...\n.\n.\n.");
  next();
}); // msg da raiz
app.post("/", server.loginUser); // resposta de solicitações de login
app.get("/porta", (req, res) => {
  res.redirect("../porta.html");
});
app.get("/visitante/:id", (req, res) => {
  res.redirect(`../guest.html?id=${req.params.id}`);
});
app.get("/admin", (req, res) => {
  res.redirect("./admin.html");
});
app.get("/vite", (req, res) => {
  res.redirect("../iacesso vite/index.html");
});
app.get("/auth", (req, res) => {
  res.send("Necessário Nome e Password!");
});
app.get("/snapshot", server.snapshot);
app.post("/loadguest", server.loadGuest);
app.post('/getsnap', server.getSnapshot);
app.post("/auth", server.loginUser); // resposta de solicitações de login
app.post("/access", server.access);
app.post("/accessusers", server.usersAccess);
app.get("/dologout", server.doLogout); // verifica o login e faz o logout do usuário
app.post("/mail2newpassword", server.mail2NewPassword);
app.get("/forgotpass", server.forgotPass); // requisição de mudança de password recebida pelo email
app.post("/forgotpass", server.forgotPass); // requisição de mudança de password de vuePass.js
app.post("/changepass", server.changePass); //muda o password do cliente
app.post("/guests", server.guests); //lista visitantes de um usuário
app.post("/renewguest", server.renewGuest); //renova acesso de usuário por mais 30 dias
app.post("/addguest", server.addGuest); //cadastra um visitante na leitora
app.post("/delguest", server.delGuest);
app.post("/open", server.openDoor);
app.post("/alarmoff", server.alarmOff);
app.get("/utech", server.utech); // notificações da leitora marca utech
app.post("/lac", server.lac); // notificações da leitora da Ac Control LAC
app.post("/webpush", server.webPush); // solicitação de notificação webpush do navegador do cliente
app.post("/sendtestnotification", server.sendTestNotification);
app.get("/authadmin", serverAdm.loginAdmin);
app.post("/authadmin", serverAdm.loginAdmin);
app.post("/condounits", serverAdm.condoUnits);
app.post("/condoctrls", serverAdm.condoEquipments); //controllers
app.post("/updatefield", server.updateField);
app.post("/fieldexist", server.fieldExist);
app.post("/sendTTest", server.telegramTest);
app.post("/qrdinamico", server.qrDinamico);
app.get("/userPhoto", server.getUserPhoto);
app.post("/newtelegramcode", server.newTelegramCode);
app.post("/telegramUpdate", server.telegramUpdate);

/// catch 404 and forwarding to error handler
app.use(function (req, res, next) {
  var err = new Error("Requisição não encontrada!");
  err.status = 404;
  next(err);
});

/// error handlers

// development error handler
// will print stacktrace
if (app.get("env") === "development") {
  app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    res.render("error", {
      message: err.message,
      error: err,
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function (err, req, res, next) {
  res.status(err.status || 500);
  res.render("error", {
    message: err.message,
    error: {},
  });
});

//app.listen(4000, () => console.log(`Listening on 4000`));
app.listen(port, function () {
  console.log("Listening on port %s", port);
});
module.exports = app;
