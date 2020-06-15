const express = require('express');
const session = require('express-session');
require('dotenv/config');
var path = require('path');
var favicon = require('static-favicon');
var logger = require('morgan');
var bodyParser = require('body-parser');
const cors = require('cors');
var server = require('./server');
var port = process.env.PORT || 3000;
const app = express();
//const router = express.Router()

var corsOptions = {
    origin: true,
    credentials: true };
app.use(cors(corsOptions));

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(favicon());
app.use(logger('dev'));
app.use(bodyParser.json()) // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })) // for parsing application/x-www-form-urlencoded


app.use(express.static(path.join(__dirname, 'public'))); //define pasta 'public' como página web estática
app.use('/node_modules', express.static('node_modules'))
app.use(session({ //inicializando express-session
    secret: 'ctrlgrn',
    resave: false,
    saveUninitialized: true,
    cookie:{ maxAge:1000*60*60*24 } //24 horas
  }));

app.use('/', (req, res, next) => {console.log("requisição recebida"); next();}) // msg da raiz
//app.use('/', routes);
app.post('/', server.qLogin);   // resposta de solicitações de login
//app.use('/users', users);
app.get('/auth', (req, res) => {res.send('Necessário Nome e Password!'); });
app.post('/auth', server.qLogin);   // resposta de solicitações de login
app.post('/access', server.access);
app.get('/dologout', server.doLogout);    // verifica o login e faz o logout do usuário
app.post('/guests', server.guests);  //lista visitantes de um usuário 
app.post('/addguest', server.addGuest);  //cadastra um visitante na leitora 
app.post('/delguest', server.delGuest);
app.post('/open', server.openDoor);
app.get('/utech', server.utech); //recebe notificações da leitora
app.post('/webpush', server.webPush); //recebe solicitação de notificação do navegador do cliente
app.get('/sendtestnotification', server.sendTestNotification);

/// catch 404 and forwarding to error handler
app.use(function(req, res, next) {
    var err = new Error('Requisição não encontrada!');
    err.status = 404;
    next(err);
});

/// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});

//app.listen(4000, () => console.log(`Listening on 4000`));
app.listen(port, function () {
    console.log('Umbler listening on port %s', port);
});
module.exports = app;
