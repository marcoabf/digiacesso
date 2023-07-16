var moment = require("moment");
var f = require("./functions");
const hex = require('ascii-hex');
var randomstring = require("randomstring");
const save = require('save-file');
var port = process.env.DB_PORT || 3306;
var nodemailer = require("nodemailer");
const axios = require("axios");
const mysql = require("mysql2");
const http = require('http'); // or 'https' for https:// URLs
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const { send } = require("process");
const { NULL } = require("mysql2/lib/constants/types");
const { now } = require("underscore");
const mqtt = require('mqtt')

var mqttOptions = {
  host: 'broker.hivemq.com',
  port: 1883,
  username: 'marcoabf',
  password: 'tvazul25'
}

const mqttClient = mqtt.connect(mqttOptions)

const pool = mysql.createPool({
  connectionLimit: 50,
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_DATABASE,
  port: port,
});

const promisePool = pool.promise();
let transporter = nodemailer.createTransport(f.nodemailerData);



const isValidSaveRequest = (req, res) => {
  // verifica se a requisição possui endpoint.
  console.log(req.body.endpoint);
  if (!req.body || !req.body.endpoint) {
    // Not a valid subscription.
    res.status(400);
    res.setHeader("Content-Type", "application/json");
    res.send(
      JSON.stringify({
        error: {
          id: "no-endpoint",
          message: "Subscription must have an endpoint.",
        },
      })
    );
    return false; // retorna falso (não é uma requisição valida)
  }
  return true; // true: é uma requisição válida
};

let readings = {}; // objeto que guarda a última leitura da controladora (ver getReadings)

module.exports = {
  snapshot(req, res) {
    let ms = Date.now()
    let dest = `./snapshots/file${ms}.jpg`
    let url = "http://192.168.0.144/onvif/snapshot"
    const file = fs.createWriteStream(dest);
    const request = http.get(url, function (response) {
      response.pipe(file);
      file.on('finish', function () {
        file.close();  // close() is async, call cb after close completes.
        res.send("ok")
      });
    }).on('error', function (err) { // Handle errors
      fs.unlink(dest); // Delete the file async. (But we don't check the result)
      res.send("erro")
    });
  },
  async loginUser(req, res) {
    //-------- processo de login
    console.log("login em curso")
    let username = req.body.username;
    let password = req.body.password;
    //console.log(req.session);
    var query = "SELECT users.id, username, users.password, email, firstname, lastname, telegram, users.type, users.unit, users.notify, ";
    query += " users.condoid, condos.name as condoName, controllers.id as ctrlID, controllers.name as ctrlName ";
    query += " from users, condos, controllers WHERE ";
    if (req.body.loggedin == true && req.body.userId) {
      query += " users.id=? AND users.condoid=condos.id AND users.condoid=controllers.condoid";
      pool.query(query, [req.body.userId], function (error, results, fields) {
        if (error) throw error;
        console.log(results);
        if (results.length > 0) {
          console.log("Dados de usuário recuperados.");
          results.forEach((item)=>{
            if (item.password) item.password='****'
          })
          res.send(results);
        }
      });
    } else if (username && password) {
      query += " users.username=? AND users.condoid=condos.id AND users.condoid=controllers.condoid";
      pool.query(query, [username, password], function (error, results, fields) {
        if (error) throw error;
        console.log(results);
        if (results.length > 0) {
          bcrypt.compare(password, results[0].password, function (err, result) {
            console.log('resultado da comparacao:')
            console.log(result)
            if (result) { // SE result=true ENTAO senha ok
              console.log("Consulta do BD retornou registro.");
              console.log(req.sessionID);
              console.log(results[0].id);
              req.session.loggedin = true;
              req.session.username = username;
              req.session.userid = results[0].id;
              req.session.condoid = results[0].condoid;
              results.forEach((item)=>{
                if (item.password) item.password='****'
              })
              res.send(results);
            } else {
              res.send("Senha incorreta!");
            }
          });
        } else {
          res.send("Usuário ou senha incorretos!");
        }
      });
    } else {
      //quando não for passado o username e password
      res.send("Por favor, entre com um usuário e password.");
    }
  },
  getUserPhoto(req, res) {
    console.log("enviando foto..")
    res.sendFile('/userphotos/1.jpg', options, function (err) {
      if (err) {
        next(err)
      } else {
        console.log('Sent:', fileName)
      }
    })
  },
  async fieldExist(req, res) {
    //verifica se o campo existe - tabela, campo, valor
    // SELECT * FROM tabela WHERE campo=valor
    let query = `SELECT * FROM ${req.body.tbl} WHERE ${req.body.fname} = ?`;
    const rowInsert = await promisePool
      .query(query, [req.body.fvalue])
      .then(([rows, fields]) => {
        console.log(rows[0]);
        if (rows.length > 0) {
          res.send("true");
        } else res.send("false");
      })
      .catch((err) => {
        console.log(err);
        res.send("Erro ao consultar!");
      });
  },
  async updateField(req, res) {
    //atualiza baseado nos seguintes dados - UPDATE tabela SET campo=valor, WHERE id = o-id
    let query = `UPDATE ${req.body.tbl} SET ${req.body.fname} = ? WHERE id=? `;
    const rowInsert = await promisePool
      .query(query, [req.body.fvalue, req.body.fid])
      .then(([rows, fields]) => {
        console.log(rows[0]);
        res.send("Dados atualizados!");
      })
      .catch((err) => {
        console.log(err);
        res.send("Dados não foram atualizados!");
      });
  },
  async insertRow(req, res) {
    //insere um registro baseado nos seguintes dados - tabela, CAMPOS[], VALORES[]
    // INSERT INTO tabela (campo1, campo2, campo3,...) VALUES (valor1, valor2, valor3,...)
  },
  async deleteRow(req, res) {
    //exclui um registro baseado nos seguintes dados - tabela, o-id
    // DELETE FROM tabela WHERE id = 0-id
  },
  doLogout(req, res) {
    //----- processo de logout
    console.log(req.session.username);
    console.log(req.session.id);
    req.session.userid = "";
    req.session.loggedin = false;
    res.end();
  },
  async mail2NewPassword(req, res) {
    console.log('new password...')
    //envia um email quando solicitada nova senha na tela de login
    var userId;
    let query = "SELECT * FROM users WHERE email=?";
    const rowUser = await promisePool
      .query(query, [req.body.email])
      .then(([rows, fields]) => {
        console.log(rows.length);
        if (rows.length > 0) {
          userId = rows[0].id;
        } else {
          res.send("Este e-mail não está cadastrado para nenhum usuário.");
        }
      })
      .catch((err) => console.log(err));
    if (userId != null) {
      let dtc = moment().format("YYYY-MM-DD_HH:mm:ss");
      let key = randomstring.generate({
        length: 8,
        capitalization: 'lowercase'
      });
      key = key + userId;
      let link = "https://www.iacesso.com.br/forgotpass/?link=" + key;
      let mailContent = "<h1> _iACESSO </h1> <p> Como solicitado, segue o link para mudança de senha. <BR> ";
      mailContent += '<a href="' + link + '"> ' + link + "</a>";
      //when changing email then object = 1
      let query2 = "INSERT INTO pending (object, idobject, dtlimit, data) VALUES ('mail', ?, ?, ?)";
      const insertPendency = await promisePool
        .query(query2, [userId, dtc, key])
        .then(([rows, fields]) => {
          console.log("inserindo...");
          console.log(rows);
          var mailOptions = {
            from: '"iACESSO" <contato@accontrol.com.br>',
            to: req.body.email,
            subject: "Mudança de senha",
            html: mailContent,
          };
          transporter.sendMail(mailOptions, function (error, info) {
            //enviando o email
            if (error) {
              console.log(error);
              res.send("Seu e-mail não pôde ser enviado. Tente novamente!");
            } else {
              console.log("Email sent: " + info.response);
              res.send("E-mail enviado com sucesso!");
            }
          });
        })
        .catch((err) => console.log(err));
    }
  },
  async forgotPass(req, res) {
    // -- requisição de novo password. Após clicar no link do email.
    console.log("verificando a requisição de mudança de senha...");
    var update = false;
    var link = req.query.link; // pega parametro link da requisição get
    if (req.body.data != null) {
      link = req.body.data;
    } // pega parametro link da requisição post
    let query = "SELECT * FROM pending WHERE object = 'mail' AND data=? ORDER BY id DESC";
    if (link == null) link = "0";
    const rowUser = await promisePool
      .query(query, [link])
      .then(([rows, fields]) => {
        if (rows.length > 0) {
          console.log("selecao > 0")
          let timeLimit = moment().subtract(10, "m").format("YYYY-MM-DD HH:mm:ss"); // limit p/ mudar a senha: 10 minutos
          var date1 = rows[0].dtlimit + "";
          var date2 = date1.split(".");
          date1 = date2[0];
          console.log(timeLimit);
          console.log(date1);
          if (moment(timeLimit).isAfter(date1)) {
            console.log("isAfter");
            res.send("Sessão expirada. Faça uma nova solicitação.");
          } else if (req.body.password == null) {
            console.log("isBefore");
            res.redirect("../pass.html?data=" + link);
          } else {
            update = true;
          } // se password != null então senha pode ser atualizada
        } else {
          console.log("Não foi possível identificar a requisição.");
        }
      })
      .catch((err) => console.log(err));
    if (update === true) {
      console.log("update true");
      let userId = req.body.data.slice(8);
      const crypted = await bcrypt.hash(req.body.password, saltRounds)
      console.log(crypted)
      let query = "UPDATE users SET password=? WHERE id=?";
      const rowInsert = await promisePool
        .query(query, [crypted, userId])
        .then(([rows, fields]) => {
          res.send("Senha Atualizada!")
        })
        .catch((err) => console.log(err));
    }
  },
  async changePass(req, res) {
    // ---- mudança de senha dentro da aplicaçao
    console.log("mudando a senha dentro do app...");
    const crypted = await bcrypt.hash(req.body.password, saltRounds)
    console.log(crypted)
    let query = "UPDATE users SET password=? WHERE id=?";
    const rowInsert = await promisePool
      .query(query, [crypted, req.body.userId])
      .then(([rows, fields]) => {
        console.log(rows[0]);
        res.send("Senha alterada!");
      })
      .catch((err) => {
        console.log(err);
        res.send("Não foi possível alterar a senha!");
      });
  },
  async lac(req, res) {
    // recebe o qrcode, verifica acesso e envia comando de abertura
    console.log("leitor AC Control");
    console.log(req.headers);
    console.log("query:");
    console.log(req.body);
    let dadosUser = await f.QrUserResponsible(req.body.qr);
    let dataHora = moment().format();
    let agent = req.headers["data-agent"].split('/')
    let brand = agent[0], serial = agent[1];
    let x = 0;
    while (serial.charAt(x) === "0") {
      x += 1;
    }
    serial = serial.slice(x, serial.length);
    let controladora = await f.controllerBySerial(brand, serial);
    console.log('controladora')
    console.log(controladora)
    let idAccess = null
    if (controladora) {
      // Insere dados do acesso
      var query = "INSERT INTO access(datetime, controllerid, userid, state, request) VALUES(?, ?, ?, ?, ?)";
      const rInsertAccess = await promisePool
        .query(query, [dataHora, controladora.id, dadosUser.idUser, 'granted', 'door'])
        .then(([rows, fields]) => {
          console.log("inserindo...");
          console.log(rows);
        })
        .catch((err) => {
          console.log("erro:");
          console.log(err);
        });
      let dtUnix = moment(dataHora).format('X')
      console.log(dtUnix)
      if (controladora.camera) f.snapshot(dtUnix, controladora.id, controladora.camera)
    }


    //const cmd = await axios.get("http://192.168.0.72/set-output");
    res.status(200).end(); //responde como OK: 200


  },
  async utech(req, res) {
    //------utech ---- recebimento de eventos das controladoras (apenas utech)
    console.log("utech");
    console.log(req.headers);
    console.log("query:");
    console.log(req.query);
    let request = req.query.request,
      dataHora = moment().format();
    let controllerId = 0,
      condoId = 0;
    let firstname = "";
    let cHead = req.headers["user-agent"]; //user-agent -> numero de série da controladora e ID
    let cArray = cHead.split("/");
    // inserir condição: se marca = utech então prosseguir senão RETURN;
    let serial = cArray[1];
    // inserir função que vincula busca id a partir do serial
    let x = 0;
    while (serial.charAt(x) === "0") {
      x += 1;
    }
    serial = serial.slice(x, serial.length);
    console.log(serial);
    console.log(req.headers);
    if (typeof req.query.time == "string") {
      //se o campo time for passado
      dataHora = moment(req.query.time, "DDMMYYYYHHmmss").format();
    } else {
      //se o campo time não for passado pegar date do headers
      console.log("headers-date");
      let dth = req.headers.date.split(",");
      console.log(dth[1]);
      dataHora = moment(dth[1], "DD MMM YYYY HH:mm:ss", "br").format();
    }
    console.log("data-hora: " + dataHora);
    let controladora = await f.controllerBySerial('utech', serial);
    controllerId = controladora.id;
    let camera = '';
    camera = controladora.camera != null ? controladora.camera : '';
    condoId = controladora.condoid;
    if (request == "door") {
      //eventos de porta
      if (req.query.type == "relay" && req.query.state == "on") {
      }
      if (req.query.type == "breakin" && req.query.state == "on") {
        //arrombamento
        console.log("Alarme tocando");
        let sindicos = [];
        const rowFindController = await promisePool
          .query("SELECT * FROM users WHERE type<=? AND condoId=?", [2, condoId])
          .then(([rows, fields]) => {
            sindicos = rows;
          })
          .catch((err) => {
            console.log(err);
          });
        for (let i = 0; i < sindicos.length; i++) {
          if (sindicos[i].subscription != "") {
            console.log("enviando push");
            f.sendPush(sindicos[i].subscription, "Alarme", "Tentativa de arrombamento detectado!");
          }
        }
      }
    }
    if (request == "card") {
      //rfcode: rf433; card: mifare/nfc
      // var global readings //usar cache depois
      readings[controllerId] = req.query.card + "-" + req.query.state;
      console.log("cartão:");
      console.log(req.query.state);
      const rowFindUser = await promisePool
        .query("SELECT id, firstname, responsible, type, notify FROM users WHERE card = ?", [req.query.card])
        .then(([rows, fields]) => {
          //console.log(rows);
          idUser = rows.length > 0 ? rows[0].id : 0;
          firstname = rows.length > 0 ? rows[0].firstname : "QrCode não reconhecido";
          console.log("user: " + idUser + " " + firstname);
        })
        .catch((err) => console.log(err));
      if (idUser > 0) {
        var query = "INSERT INTO access(datetime, controllerid, userid, state, request) VALUES(?, ?, ?, ?, ?)";
        const rInsertAccess = await promisePool
          .query(query, [dataHora, controllerId, idUser, req.query.state, req.query.request])
          .then(([rows, fields]) => {
            console.log("inserindo...");
            console.log(rows);
          })
          .catch((err) => {
            console.log("erro::");
            console.log(err);
          });
      }
    }
    if (request == "qrcode") {
      //se for do tipo qrcode
      console.log("QRcode:");
      var qrcode = req.query.qrcode;
      console.log(qrcode);
      // Seleciona o usuário (ou Visitante) que passou o QR Code
      const dadosUser = await f.QrUserResponsible(qrcode);
      console.log("dados do usuario")
      console.log(dadosUser);
      const idUser = dadosUser.idUser;
      const firstname = dadosUser.firstname;
      const responsible = dadosUser.responsible;
      const subscription = dadosUser.subscription;
      const telegram = dadosUser.telegram;
      const emailR = dadosUser.emailR
      const notifyV = dadosUser.notifyV;
      const notifyR = dadosUser.notifyR;
      // Verifica status
      if (req.query.state == 'blocked') {
        //se usuário possui acesso
        //liberar acesso e mudar o estado de blocked para allowed
      }

      // Insere dados do acesso
      var query = "INSERT INTO access(datetime, controllerid, userid, state, request) VALUES(?, ?, ?, ?, ?)";
      const rInsertAccess = await promisePool
        .query(query, [dataHora, controllerId, idUser, req.query.state, req.query.request])
        .then(([rows, fields]) => {
          console.log("inserindo...");
          console.log(rows);
          //if(camera) f.snapshot(rows.id, rows.controllerId, dataHora, camera)
        })
        .catch((err) => {
          console.log("erro::");
          console.log(err);
        });

      // enviando webpush ou email apenas se for um visitante
      console.log("responsavel")
      console.log(responsible)
      if (responsible > 0) {
        //let obj = JSON.parse(subscription);
        let body = firstname + ": Acesso: " + f.stateBr(req.query.state);
        let msg = { title: "iACESSO", body: body };
        let notifyBin = parseInt(notifyR).toString(2).split("").reverse().join("");;

        console.log(notifyBin)
        // bits: 0- push, 1- email 2- telegram
        if (notifyBin.charAt(0) == '1') {
          console.log('push')
          f.sendPushNotification(subscription, JSON.stringify(msg))
        }
        if (notifyBin.charAt(1) == '1') {
          textoHtml = `iACESSO <br> Email informativo. Não responder <br> Detectado Acesso: <br> ${body}`,
            f.envEmail(emailR, body, textoHtml);
        }
        if (notifyBin.charAt(2) == '1') {
          // funcao de envio do telegram
          f.sendTelegramMsg(telegram, body);
        }
      }
      // inserir aqui código de verificar pendencias da controladora
    } //fim qrCode
    res.status(200).end();
  }, //---------------------utech
  //envia a leitura do código de cartao ou rfcode pela controladora
  getReading(req, res) {
    let code = readings[req.body.ctrlId];
    return code;
  },
  guests(req, res) {
    //lista visitantes
    query = "SELECT * FROM users WHERE responsible=? AND type<10 ORDER BY dtchanged DESC, firstname ASC"; //dados dos visitantes from user;
    pool.query(query, [req.body.userID], function (error, results, fields) {
      if (error) throw error;
      res.send(results);
    });
  },

  async addGuest(req, res) {
    console.log("addGuest");
    var tStamp = Date.now(); // unix time com 13 caracteres (milisegundos)
    //padrao do qrcode: userID-X-YYYY-Z onde YYYY é um número aleatório e X é tipo de usuário
    qrcode = randomstring.generate({
      length: 16,
      capitalization: 'lowercase'
    }); //gera uma string randomica de X caracteres
    //qrcode = "req.body.responsible" + "-" + req.body.type + "-" + qrcode;
    qrcode = tStamp + qrcode;
    let name = req.body.name;
    let hIn = req.body.hinicial;
    let hOut = req.body.hfinal;
    name = name == "" ? "Sem nome" : name;
    console.log(name);
    hIn = hIn.toString;
    hIn = hIn.length == 1 ? "0" + hIn : hIn;
    hOut = hOut.toString;
    hOut = hOut.length == 1 ? "0" + hOut : hOut;
    let perm = req.body.days + " " + req.body.hinicial + ":00-" + req.body.hfinal + ":59";
    let key = req.body.responsible;
    key = moment().subtract(3, "h").format("YYYYMMDD");
    let dtc = moment().subtract(3, "h").format("YYYY-MM-DD HH:mm:ss");
    let user = await f.userFrmQr(qrcode)
    if (user) {
      let repet = Number(rows.length) + 1;
      qrcode += repet; // cria um diferenciador caso exista um qrcode igual
    }
    let arrayValues, query
    if (req.body.userid > 0) {
      arrayValues = [name, perm, req.body.userid]
      query = "UPDATE users SET firstname=?, perm=? WHERE id=?"
      const update = await promisePool
        .query(query, arrayValues)
        .then((rows, fields) => {
        })
        .catch((err) => console.log(err))
    } else {
      arrayValues = [name, req.body.condoid, req.body.unit, req.body.type, req.body.responsible, perm, qrcode, dtc, dtc]
      console.log("INSERINDO USUARIO ------------------------------")
      query = "INSERT INTO users (firstname, condoid, unit, type, responsible, perm, qrcode, dtcreated, dtchanged) ";
      query += "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
      const inserir = await promisePool
        .query(query, arrayValues)
        .then((rows, fields) => {
        })
        .catch((err) => console.log(err))
      //--------
      // Atualização dos dados atualizados/adicionados nas controladoras uTech
      let xRows, y = 0, x = 0;
      let control;
      xRows = await f.controllersFrmCondo(req.body.condoid)

      for (let i = 0; i < xRows.length; i++) {
        if (xRows[i].brand.toLowerCase() == "utech") {
          console.log("enviando para utech");
          if (typeof xRows[i].ip == "string") {
            //se existir IP entao cadastra
            let user = await f.userFrmQr(qrcode)
            let xUser = await f.userFrmId(user.id)
            xUser.key = key
            if (await f.utechAddUser(xRows[i], xUser, true)) {
              y += 1;
              // senao poeNaFila //cronjob para atualizar depois
            }
          }
          x += 1;
        }
      }
    }
    res.send("ok")
  }, // fim do addGuest

  async renewGuest(req, res) {
    // atualiza dtChanged do usuário para novos acessos
    console.log("renova usuario guest");
    let condoId = req.body.condoId
    let userId = req.body.guestId
    //let dtc = moment().subtract(3, "h").format("YYYY-MM-DD HH:mm:ss");
    let dtc = moment().add(1, "d").hour(0).minute(0).second(0).format("YYYY-MM-DD HH:mm:ss");
    const upd = await f.updateUser(userId, 'dtchanged', dtc)

    // row: lista das controladoras que devem ter o usuário/visitante modificados
    let xRows = await f.controllersFrmCondo(condoId)
    console.log(xRows);
    var x = 0,
      y = 0;
    while (x < xRows.length) { //exclui e adiciona usuário com dados novos
      if (xRows[x].brand.toLowerCase == 'utech') {
        await f.utechDelUser(xRows[x], qrcode)
        if (await f.utechAddUser(xRows[x], xUser, true)) {
          y += 1;
          // poeNaFila //cronjob para atualizar depois
        }
      }
      x += 1;
    }
    if (y == xRows) { //se true não houve falha na comunicação com as controladoras
      //tipos entre 11 e 19 são usuários desabilitados
      const usuario = await f.userFrmId(userId)
      if (usuario) {
        if (usuario.type >= 10) f.updateUser(userId, 'type', usuario.type - 10)
      }
    } else {
      res.send("Não foi possível renovar os dados em todos os acessos! Tente novamente.");
    }
    res.send("Usuário Renovado!")
  },

  async updateGuest(req, res) {
    // atualiza campos do usuário

  },
  async loadGuest(req, res) {
    //envia dados do visitante a partir do qrcode
    let qrcode = req.body.qrcode
    let guest = null
    console.log("qrcode:")
    console.log(qrcode)
    const row = await promisePool
      .query(`SELECT users.id, firstname, cellphone, users.type, responsible, qrcode, qrdinamico, lifecount, perm, 
      condos.id as condoId, condos.name as condoName, condo_pai, 
      controllers.id as ctrlid, controllers.name as ctrlname, brand, model, opt
      FROM users, condos, controllers 
      WHERE qrcode=? AND responsible>0 AND users.type<10 AND users.condoid=condos.id AND users.condoid=controllers.condoid`, [qrcode])
      .then(([rows, fields]) => {
        console.log(rows.length)
        if (rows.length > 1) guest = rows
      })
    if (guest) res.send(guest); else res.send("Visitante não encontrado!")
  },

  async delGuest(req, res) {
    console.log("delete guest");
    console.log(req.body.condoId);
    console.log(req.body.qrCode);
    // row: lista das controladoras que devem ter o usuário/visitante excluído
    let xRows
    const row = await promisePool
      .query("SELECT * FROM controllers WHERE condoid=?", [req.body.condoId])
      .then(([rows, fields]) => {
        console.log(rows);
        xRows = rows
      })
      .catch((err) => console.log(err));

    var x = 0, u = 0,
      y = 0;

    while (x < xRows.length) {
      if (xRows[x].brand.toLowerCase() == 'utech') {
        try {
          const response = await axios.post(
            "http://" + xRows[x].ip + ":" + xRows[x].port + "/?request=deluser",
            {
              qrcode: req.body.qrCode,
            },
            {
              withCredentials: true,
              auth: {
                username: xRows[x].user,
                password: xRows[x].password,
              },
            }
          );
          console.log("delete enviado com sucesso ao utech");
          console.log(response);
          y += 1;
        } catch (error) {
          console.error(error);
          if (error.response) if (error.response.status == 400) {
            y += 1;
          }
        }
        u += 1;
      }
      x += 1;
    }
    if (y == u) {
      //tipos entre 11 e 19 são usuários desabilitados
      res.send("Dados excluídos com sucesso!");
      console.log("excluindo usuário no banco de dados")
      const row1 = await promisePool
        .query("UPDATE users SET type=type+10 WHERE qrcode=?", [req.body.qrCode])
        .then(([rows, fields]) => {
          console.log(rows)
        })
        .catch((err) => console.log(err));
    } else {
      res.send("Não foi possível excluir os dados em todos os acessos! Tente novamente.");
    }
  },
  async openDoor(req, res) {
    // comando para abrir porta f.
    let ctrlId = req.body.ctrlID;
    let lat = req.body.lat, lon=req.body.lon, acc=req.body.acc
    let request = req.body.origem; // info para a tabela access
    let state = "granted"; // info para a tabela access
    let ctrlData = {}, userData = {};
    let userId = req.body.userId;
    let dt = moment().format();
    let strkey = '0000000000000000'
    console.log(ctrlId);
    console.log(userId)
    const user = await promisePool //buscando dados do usuário para verificar o horário permitido para acesso
      .query("SELECT * FROM users WHERE id=?", [userId])
      .then(([rows]) => {
        console.log(rows)
      })
      .catch((err) => {
        console.log(err);
      });
    if (!f.permVerify(userData.perm)) {
      res.send("Não é permitido acesso nesse horário!")
      console.log("Permissão não concedida")
    }
    const result = await promisePool //buscando dados da controladora que receberá o comando
      .query("SELECT * FROM controllers WHERE id=?", [ctrlId])
      .then(([rows]) => {
        ctrlData = rows[0];
        console.log(rows[0].ip + ":" + rows[0].user + ":" + rows[0].password);
      })
      .catch((err) => {
        console.log(err);
      });
    if(ctrlData.opt==1 && req.body.acc<ctrlData.acc && req.body.acc!=null){
      //verifar se está no local
      let dist = f.distanciaLatLon(ctrlData.lat, ctrlData.lon, req.body.lat, req.body.lon)
      if (dist<ctrlData.dmax) {
        abrir = true;
      }
    }
    strkey = ctrlData.cipherkey;

    // verificando abertura por latitude e longitude
    if (ctrlData.opt == 1 && ctrlData.lat && ctrlData.lon && req.body.lat) {
      let dist = distancia(ctrlData.lat, ctrlData.lon, req.body.lat, req.body.lon)
      //se accuracy ou distancia máxima está excedendo, então retorna e bloqueia abertura.
      if (req.body.acc>ctrlData.accmax || dist > ctrlData.dmax) res.send("Abertura por localização negada!");
    }

    console.log("enviando requisição");
    console.log(ctrlData)
    console.log(ctrlData.brand.toLowerCase())
    let serial = ctrlData.serial
    let x = 0;
    // Tirando os zeros à esquerda do número serial
    while (serial.charAt(x) === "0") {
      x += 1;
    }
    serial = serial.slice(x, serial.length);
    //Comando de abertura para a controladora
    if (ctrlData.brand.toLowerCase() == "utech") {

      axios
        .get("http://" + ctrlData.ip + "/?request=relay&interface=0&state=on", {
          withCredentials: true,
          auth: {
            username: ctrlData.user,
            password: ctrlData.password,
          },
        })
        .then(function (response) {
          console.log("resposta: ");
          console.log(response.data);
          // incluir funcao para add registro na tabela access
          console.log("registrando acesso na tabela");
          const ins = f.insertAccess(dt, ctrlId, userId, state, request);
          res.send("Comando enviado!");
        })
        .catch(function (error) {
          console.log(error);
          res.send("Erro ao enviar requisição.");
        }); // axios.get
    }
    if (ctrlData.brand.toLowerCase() == "accontrol") {
      console.log(`open:${ctrlData.user}:${ctrlData.password}`)
      let tempo = Date.now()
      tempo = tempo.toString().slice(0,7)
      let hexCod = f.codify(strkey, `open:${serial}:${tempo}`)
      console.log(hexCod);
      console.log(hexCod.length)
      mqttClient.publish(`iacesso:${serial}`, hexCod)
      // incluir funcao para add registro na tabela access
      console.log("registrando acesso na tabela (accontrol)");
      const ins = f.insertAccess(dt, ctrlId, userId, state, request);
      res.send("Comando enviado!");
    }
    //}); //query
  },
  alarmOff(req, res) {
    // comando para abrir porta
    ctrlId = req.body.ctrlID;
    pool.query("SELECT * FROM controllers WHERE id=?", [ctrlId], function (error, result) {
      if (error) throw error;
      console.log(result[0].ip + ":" + result[0].user + ":" + result[0].password);
      axios
        .get("http://" + result[0].ip + "/?request=alarm&interface=0&state=off", {
          withCredentials: true,
          auth: {
            username: result[0].user,
            password: result[0].password,
          },
        })
        .then(function (response) {
          console.log(response);
          res.send("Comando enviado!");
        })
        .catch(function (error) {
          console.log(error);
          res.send("Erro ao enviar requisição.");
        }); // axios.get
    }); //query
  },
  access(req, res) {
    // Mostra a lista de acessos de visitantes
    console.log("Access");
    let userID = req.body.userID;
    console.log(userID);
    let queryUsers = "SELECT datetime, firstname, lastname, state FROM access, users, controllers ";
    queryUsers += "WHERE condos.id=?  AND ";
    let query = "SELECT datetime, firstname, lastname, state, controllers.name as ctrlName ";
    query += " FROM access, users, controllers  WHERE users.responsible=? ";
    // seleciona apenas visitantes deste usuário
    query += " AND users.id=access.userid AND access.controllerid=controllers.id  ";
    query += " ORDER BY datetime DESC LIMIT 0, ?";
    pool.query(query, [userID, req.body.limit], function (error, results, fields) {
      if (error) throw error;
      console.log(results);
      if (results.length > 0) res.send(results);
      else res.send("Sem registros de acesso!");
    });
  },
  usersAccess(req, res) {
    // Mostra a lista de acessos completa com todos os usuários do condomínio
    console.log("Users Access");
    let query =
      "SELECT datetime, controllerid, users.firstname as firstname, users.lastname as lastname, users.unit, users.responsible, request, state, r.firstname as rName, controllers.name as porta, controllers.camera as cam ";
    query += "FROM access, controllers, condos, users LEFT JOIN users r ON users.responsible = r.id ";
    // users r duplica a tabela de usuários para pegar o nome do responsável
    query += " WHERE condos.id=? AND access.controllerid=controllers.id AND users.id=access.userid ";
    query += " ORDER BY datetime DESC LIMIT 0, ?";
    pool.query(query, [req.body.condoId, req.body.limit], function (error, results, fields) {
      if (error) throw error;
      console.log(results);
      if (results.length > 0) res.send(results);
      else res.send("Sem registros de acesso!");
    });
  },
  webPush(req, res) {
    console.log("webpush:");
    console.log(req.body);
    if (!isValidSaveRequest(req, res)) {
      return;
    }
    console.log("É VÁLIDO!");
    strBody = JSON.stringify(req.body);
    query = "UPDATE users SET subscription=? WHERE id=?";
    pool.query(query, [strBody, req.body.userid], function (error, results, fields) {
      if (error) throw error;
      console.log(results);
      res.setHeader("Content-Type", "application/json");
      res.send(JSON.stringify({ success: true }));
    });
  },
  sendTestNotification(req, res) {
    console.log('SendTestNotification...')
    console.log(req.body.userId)
    query = "SELECT * FROM users WHERE id=?";
    pool.query(query, [req.body.userId], function (error, results) {
      if (error) {
        console.log('erro.')
        throw error;
      }
      console.log("Enviando Noticação");
      if (results.length > 0) {
        console.log('existe usuário')
        let subscription = results[0].subscription;
        let obj = JSON.parse(subscription);
        delete obj.expirationTime;
        subscription = JSON.stringify(obj);
        console.log(subscription);
        let msg = { title: "iACESSO", body: "Notificação em funcionamento" };
        f.sendPushNotification(subscription, JSON.stringify(msg))
        res.send("Notificação enviada!");
        return;
      }
      res.send("Usuário não encontrado!");
    });
  },
  async newTelegramCode(req, res) {
    let code = randomstring.generate({
      length: 4,
      charset: 'numeric'
    })
    code = "c" + code;
    let id = req.body.userId
    console.log(id)
    console.log('\n\n\n')
    let query = "UPDATE users SET telegram = ? WHERE id = ?"
    const rowSQL = await promisePool
      .query(query, [code, id])
      .then(([rows, fields]) => {
        res.send(code)
      })
      .catch((err) => {
        console.log(err);
        res.send("Falha ao gerar código!");
      });
  },
  async telegramUpdate(req, res) {
    let codigo = req.body.codigo, chatId;
    const response = await axios.get("https://api.telegram.org/bot1140456861:AAHHhjj7mi0ZlWDTQLEIwPa7rgoRUOo22gU/getUpdates");
    console.log(response.data.result[0].message);
    for (let i = 0; i < response.data.result.length; i++) {
      if (response.data.result[i].message.text == codigo)
        chatId = response.data.result[i].message.chat.id;
    }
    if (chatId != null) {
      let query = "UPDATE users SET telegram=? WHERE id=?"
      const rowUpdate = await promisePool
        .query(query, [chatId, req.body.userId])
        .then(([rows, fields]) => {
          res.send("Atualização feita com sucesso!")
        })
        .catch((err) => {
          console.log(err);
          res.send("Dados não foram atualizados!");
        });

    }
  },
  async telegramTest(req, res) {
    let chatId = '';
    if (req.session.userid == "") { res.end; }
    let query = "SELECT * FROM users WHERE id=?";
    const rowSQL = await promisePool
      .query(query, [req.session.userid])
      .then(([rows, fields]) => {
        chatId = rows[0].telegram;
      })
      .catch((err) => {
        console.log(err);
        res.send("Dados não foram atualizados!");
      });
    f.sendTelegramMsg(chatId, req.body.msg);
    res.end;
  },
  async qrDinamico(req, res) {
    // gera um qr code baseado no horário e codifica
    console.log("\n\n\nGerando QR Dinamico\n")
    let alerta = null
    let strKey = '0000000000000000' //tamanho = 16 //senha do AES
    var tStamp = Date.now();
    console.log(tStamp);
    var qrcode = randomstring.generate(2); //gera uma string randomica de X caracteres
    qrcode = qrcode + '0';
    qrcode = tStamp + qrcode;
    console.log(qrcode)

    const pesq1 = await promisePool
      .query("SELECT * FROM controllers WHERE id=?", [req.body.controllerId])
      .then(([rows, fields]) => {
        if (rows.length > 0) {
          console.log(rows[0].brand.toLowerCase())
          if (rows[0].brand.toLowerCase() != "accontrol") {
            alerta = "Essa porta não possui suporte a QrCode Dinâmico!"
            console.log(alerta)
          }
          if (rows[0].cipherkey) strKey = rows[0].cipherkey //guarda a chave de criptografia da controladora
        }
      })
      .catch((err) => {
        console.log(err);
        res.send("Erro na pesquisa da controladora!");
      });

    //verifica se já existe um qrcode igual
    const pesq2 = await promisePool
      .query("SELECT * FROM users WHERE qrdinamico=?", [qrcode])
      .then(([rows, fields]) => {
        let repet = Number(rows.length) + 1;
        qrcode += qrcode.slice(0, 15) + repet.toString(); // cria um diferenciador caso exista um qrdinamico igual
      })
      .catch((err) => {
        console.log(err);
        res.send("Erro na pesquisa de usuário-qrcode!");
      });
    console.log("QRcode: " + qrcode);
    console.log("QRcode tamanho: " + qrcode.length);

    //inicio da codificação do qrcode 
    let encryptedHex = f.codify(strKey, qrcode)

    let qrCodificado = 'QD' + encryptedHex + req.body.userID;
    console.log("QR Codificado: ", qrCodificado);
    console.log("Tamanho: " + qrCodificado.length)

    // busca por usuário
    console.log(req.body)
    const pesq3 = await promisePool
      .query("SELECT * FROM users WHERE id=?", [req.body.userID])
      .then(([rows, fields]) => {
        if (rows.length == 1) {
          console.log(rows[0].perm)
          if (rows[0].perm)
            if (!f.permVerify(rows[0].perm)) alerta = "Não é permitido acesso nesse horário!"
          // atualiza o qrcode do usuário
          pool.query("UPDATE users SET qrdinamico = ? WHERE id=?", [qrCodificado, req.body.userID], function (error, result, fields) {
            if (error) throw error;
            //console.log(result);
          });
        }
      })
      .catch((err) => {
        console.log(err);
        res.send("Erro na pesquisa/atualização de usuário!");
      });

    console.log("mensagem")
    console.log(alerta)
    if (alerta) res.send(alerta); else res.send(qrCodificado);

  },
  async getSnapshot(req, res) {
    // envia o arquivo
    console.log("pull image")
    console.log(path.join(__dirname, 'snapshots'))
    var options = {
      root: path.join(__dirname, 'snapshots')
    };

    var fileName = req.body.arquivo;
    res.sendFile(fileName, options, function (err) {
      if (err) {
        res.send(err);
      } else {
        console.log('Enviado:', fileName);
        res.end();
      }
    });
  },
  async regMqtt(dados) { //Registra acesso do mqtt no Database 
    console.log("Função MQTT")
    if (f.isJsonString(dados)) {
      console.log("JSON")
      let jVar = JSON.parse(dados);
      if (jVar.request == "QD") {
        let estado = jVar.state; // granted or blocked
        let idUser = jVar.user;

        let serial = jVar.serial;
        // inserir função que vincula busca id a partir do serial
        let x = 0;
        while (serial.charAt(x) === "0") {
          x += 1;
        }
        serial = serial.slice(x, serial.length);
        console.log(serial);

        if (typeof jVar.time == "string") {
          //se o campo time for passado
          console.log("IF")
          dataHora = moment(jVar.time, "X").format();
        } else {
          //se o campo time não for passado pegar date do headers
          console.log("Else")
          let dth = Date.now();
          console.log(dth)
          dataHora = moment(dth, "x", "br").format();
        }
        console.log("data-hora: " + dataHora);
        let controladora = await f.controllerBySerial('mqtt', serial);
        let controllerId = controladora.id;

        // Insere dados do acesso
        var query = "INSERT INTO access(datetime, controllerid, userid, state, request) VALUES(?, ?, ?, ?, ?)";
        const rInsertAccess = await promisePool
          .query(query, [dataHora, controllerId, idUser, estado, jVar.request])
          .then(([rows, fields]) => {
            console.log("inserindo...");
            console.log(rows);
            //if(camera) f.snapshot(rows.id, rows.controllerId, dataHora, camera)
          })
          .catch((err) => {
            console.log("erro::");
            console.log(err);
          });

        // Seleciona o usuário (ou Visitante) que passou o QR Code
        const dadosUser = await f.idUserResponsible(idUser);
        console.log("dados do usuario")
        console.log(dadosUser);
        //const idUser = dadosUser.idUser;
        const firstname = dadosUser.firstname;
        const responsible = dadosUser.responsible;
        const subscription = dadosUser.subscription;
        const telegram = dadosUser.telegram;
        const emailR = dadosUser.emailR
        const notifyV = dadosUser.notifyV;
        const notifyR = dadosUser.notifyR;

        // enviando webpush ou email apenas se for um visitante
        console.log("responsavel")
        console.log(responsible)
        if (responsible > 0) {
          //let obj = JSON.parse(subscription);
          let body = firstname + ": Acesso: " + f.stateBr(req.query.state);
          let msg = { title: "iACESSO", body: body };
          let notifyBin = parseInt(notifyR).toString(2).split("").reverse().join("");;

          console.log(notifyBin)
          // bits: 0- push, 1- email 2- telegram
          if (notifyBin.charAt(0) == '1') {
            console.log('push')
            f.sendPushNotification(subscription, JSON.stringify(msg))
          }
          if (notifyBin.charAt(1) == '1') {
            textoHtml = `iACESSO <br> Email informativo. Não responder <br> Detectado Acesso: <br> ${body}`,
              f.envEmail(emailR, body, textoHtml);
          }
          if (notifyBin.charAt(2) == '1') {
            // funcao de envio do telegram
            f.sendTelegramMsg(telegram, body);
          }
        }

      }


    }

  }

}; // fim do export
//-------------------------------------------------------------

