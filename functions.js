const mysql = require("mysql2");
const webpush = require("web-push");
const axios = require("axios");
var nodemailer = require("nodemailer");
const http = require('http'); // or 'https' for https:// URLs
const fs = require('fs');
var moment = require("moment");
var aesjs = require('aes-js');
var base64 = require('base-64');
var port = process.env.DB_PORT || 3306;

const pool = mysql.createPool({
  connectionLimit: 50,
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_DATABASE,
  port: port,
});
const promisePool = pool.promise();
const telegramToken = '1140456861:AAHHhjj7mi0ZlWDTQLEIwPa7rgoRUOo22gU';

const vapidKeys = {
  publicKey: "BMQhKi9b9wgTSELzr1dKaGtIcv1wXGH9TZuZ6I9s7OCLGCPlZrsBczpB2rasO6TCbDqvxh8hnzPOGu4C-IM7oXw",
  privateKey: "B_-NWqSNWz_Gh2WkzxbO5RY_kMymFj0LXzX9Tq4PH1g",
};
webpush.setVapidDetails("mailto:mb@accontrol.com.br", vapidKeys.publicKey, vapidKeys.privateKey);

let nodemailerData = {
  host: process.env.MAIL_HOST,
  port: process.env.MAIL_PORT,
  secure: true, // upgrade later with STARTTLS
  auth: {
    user: "marcobenevides@accontrol.com.br",
    pass: process.env.MAIL_PASS,
  },
  tls: {
    // do not fail on invalid certs
    rejectUnauthorized: false,
  },
}
exports.nodemailerData = nodemailerData
let transporter = nodemailer.createTransport(nodemailerData);

exports.codify = function (chave, payload){
  console.log("codificando")
  console.log(payload)
  console.log(payload.length)
  console.log(payload.length%16)
  if(payload.length%16>0){
    let resto = payload.length%16
    let falta = 16-resto;
    let total = payload.length+falta
    for(let i=payload.length; i<total; i++) {
        payload+='0';
    }
    console.log(payload)
    console.log(payload.length)

  }

  let iv = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  //convertendo a senha de string para hex
  var key = [65];
    for (let i = 0; i < 16; i++) {
      if (i < chave.length) {
        let str = chave.charCodeAt(i);
        key[i] = str
      } else key[i] = 48; // 48 = '0';
    }
    console.log("key: " + key);
    console.log("iv: " + iv)
    var textBytes = aesjs.utils.utf8.toBytes(payload);

    // Encrypt
    var aesEcb = new aesjs.ModeOfOperation.ecb(key);
    var aesCbc = new aesjs.ModeOfOperation.cbc(key, iv);
    var encryptedBytes = aesCbc.encrypt(textBytes);
    console.log("Encriptado:\n"+encryptedBytes);
    // converting to base64
    let encryptedB64 = base64.encode(encryptedBytes);
    console.log("Base64: \n" + encryptedB64);
    console.log("Tamanho: " + encryptedB64.length);
    // converting  to Hex
    var encryptedHex = aesjs.utils.hex.fromBytes(encryptedBytes);
    console.log("Hex: \n" + encryptedHex);
    console.log("Tamanho: " + encryptedHex.length);
    return encryptedHex
}
exports.distanciaLatLon = function(lat1, lon1, lat2, lon2) {  // distancia entre um ponto e outro em metros
  var R = 6378.137; // Radius of earth in KM
  var dLat = (lat2 * Math.PI / 180) - (lat1 * Math.PI / 180);
  var dLon = (lon2 * Math.PI / 180) - (lon1 * Math.PI / 180);
  dLat = Math.abs(dLat)
  dLon = Math.abs(dLon)
  console.log(lat1)
  console.log(lat2)
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  var d = R * c;
  return d * 1000; // meters
}
exports.permVerify = function (perm) {
  console.log('verificando permissao \n\n')
  if (perm.length<5 || null) return true //se não for visitante. Usuários fixos não possuem esse campo
  let permOk = false
  console.log(perm)
  if (perm.slice(1, 2) == "-") {
    let pWeekStart = Number(perm.slice(0, 1)),
      pWeekEnd = Number(perm.slice(2, 3)),
      pTime = perm.slice(4).split('-'),
      pTimeStart = pTime[0].split(':'),
      pTimeEnd = pTime[1].split(':'),
      weekNow = Number(moment().format('e')),
      HourNow = Number(moment().format('HH')),
      minNow = Number(moment().format('mm'))
    if (weekNow >= pWeekStart && weekNow <= pWeekEnd
      && HourNow >= Number(pTimeStart[0]) && HourNow <= Number(pTimeEnd[0])
      && minNow >= Number(pTimeStart[1]) && minNow <= Number(pTimeEnd[1])) { permOk = true }
  }
  console.log(permOk)
  return permOk
}

exports.isJsonString = function (str) {
  try {
    JSON.parse(str);
  } catch (e) {
    return false;
  }
  return true;
}

exports.sendPushNotification = function (subscription, msg) {
  let obj = JSON.parse(subscription);
  webpush
    .sendNotification(obj, msg, { TTL: 60 }) //sending
    .then((res) => { console.log(res) })
    .catch((err) => {
      if (err.statusCode === 404 || err.statusCode === 410) {
        console.log("Subscription has expired or is no longer valid: ", err);
        //return deleteSubscriptionFromDatabase(subscription._id);
      } else {
        console.log("SendNotification: Erro.")
        throw err;
      }
    });
}
exports.controllerBySerial = async function (brand, serial) {
  console.log(brand)
  console.log(serial)
  let id = null, condoid = null, camera = null;
  const rowFindController = await promisePool //selecionando a controladora
    .query("SELECT * FROM controllers WHERE brand=? AND serial = ?", [brand, serial])
    .then(([rows, fields]) => {
      console.log("controladora:");
      console.log(rows[0] ? rows[0].id : "sem controladora");
      id = rows[0] ? rows[0].id : null
      condoid = rows[0] ? rows[0].condoid : null
      camera = rows[0] ? rows[0].camera : null
    })
    .catch((err) => {
      console.log(err);
    });
  return {
    id: id,
    condoid: condoid,
    camera: camera
  }
}
exports.QrUserResponsible = async function (qrcode) {
  // Seleciona o usuário (ou Visitante) que passou o QR Code
  //console.log('qr:')
  //console.log(qrcode)
  let subscription = null, telegram = null
  let idUser = 0,
    responsible = null,
    emailR = null,
    notifyR = null, //tipo de notificação que o responsável pode receber
    notifyV = 0; //tipo de notificação definida para o visitante
  const rowFindUser = await promisePool
    .query("SELECT id, firstname, responsible, type, notify FROM users WHERE qrcode = ?", [qrcode])
    .then(([rows, fields]) => {
      //console.log(rows);
      idUser = rows.length > 0 ? rows[0].id : 0;
      firstname = rows.length > 0 ? rows[0].firstname : "QrCode não reconhecido";
      responsible = rows.length > 0 ? rows[0].responsible : 0;
      notifyV = rows.length > 0 ? rows[0].notify : 0;
      subscription = rows.length > 0 ? rows[0].subscription : null;
      telegram = rows.length > 0 ? rows[0].telegram : null;
      emailR = rows.length > 0 ? rows[0].email : null;
      //emailV = rows.length > 0 ? rows[0].email : 0;
      //console.log("user: " + idUser);
    })
    .catch((err) => console.log(err));

  //seleciona o usuário responsável pelo visitante
  if (responsible > 0) {
    const rowSubs = await promisePool
      .query("SELECT * FROM users WHERE id=?", [responsible])
      .then(([rows, fields]) => {
        if (rows.length > 0) {
          subscription = rows[0].subscription;
          telegram = rows[0].telegram;
          notifyR = rows[0].notify;
          emailR = rows[0].email;
        }
      })
      .catch((err) => console.log(err));
    //console.log(subscription);
  }
  return {
    idUser: idUser,
    firstname: firstname,
    notifyV: notifyV, //visitante
    responsible: responsible,
    subscription: subscription,
    telegram: telegram, //chatId do telegram
    notifyR: notifyR, //responsável
    emailR: emailR // email do responsável
  }
}
exports.idUserResponsible = async function (idUser) {
  // Seleciona o usuário (ou Visitante) que passou o QR Code
  //console.log('qr:')
  //console.log(qrcode)
  let subscription = null, telegram = null
  let responsible = null,
    emailR = null,
    notifyR = null, //tipo de notificação que o responsável pode receber
    notifyV = 0; //tipo de notificação definida para o visitante
  const rowFindUser = await promisePool
    .query("SELECT * FROM users WHERE id = ?", [idUser])
    .then(([rows, fields]) => {
      //console.log(rows);
      idUser = rows.length > 0 ? rows[0].id : 0;
      firstname = rows.length > 0 ? rows[0].firstname : "QrCode não reconhecido";
      responsible = rows.length > 0 ? rows[0].responsible : 0;
      notifyV = rows.length > 0 ? rows[0].notify : 0;
      subscription = rows.length > 0 ? rows[0].subscription : null;
      telegram = rows.length > 0 ? rows[0].telegram : null;
      emailR = rows.length > 0 ? rows[0].email : null;
      //emailV = rows.length > 0 ? rows[0].email : 0;
      //console.log("user: " + idUser);
    })
    .catch((err) => console.log(err));

  //seleciona o usuário responsável pelo visitante
  if (responsible > 0) {
    const rowSubs = await promisePool
      .query("SELECT * FROM users WHERE id=?", [responsible])
      .then(([rows, fields]) => {
        if (rows.length > 0) {
          subscription = rows[0].subscription;
          telegram = rows[0].telegram;
          notifyR = rows[0].notify;
          emailR = rows[0].email;
        }
      })
      .catch((err) => console.log(err));
    //console.log(subscription);
  }
  return {
    idUser: idUser,
    firstname: firstname,
    notifyV: notifyV, //visitante
    responsible: responsible,
    subscription: subscription,
    telegram: telegram, //chatId do telegram
    notifyR: notifyR, //responsável
    emailR: emailR // email do responsável
  }
}

exports.sendTelegramMsg = function (userChatId, msg) {
  let telegramUrl = "https://api.telegram.org/bot" + telegramToken + "/sendMessage";
  console.log(telegramUrl);
  const response = axios.post(telegramUrl, { chat_id: userChatId, text: msg }, { withCredentials: false });
  console.log(response.data);
}
exports.envEmail = function (destinatario, titulo, mensagem) {
  //envia email
  console.log('envEmail')
  var mailOptions = {
    from: '"digiACESSO" <contato@accontrol.com.br>',
    to: destinatario,
    subject: titulo,
    html: mensagem,
  };
  transporter.sendMail(mailOptions, function (error, info) {
    //enviando o email
    if (error) {
      console.log(error);
      console.log("E-mail não ppôde ser enviado. Tente novamente.");
    } else {
      console.log("Email sent: " + info.response);
      console.log("E-mail enviado com sucesso!");
    }
  });
}
exports.insertAccess = async function (dt, ctrlId, userId, state, request) {
  console.log("funcão insertACCESS");
  console.log(`dados recebidos: data: ${dt}, controladora: ${ctrlId}, usuário: ${userId}, ${state}, ${request} `);
  let query = "INSERT INTO access(datetime, controllerid, userid, state, request) VALUES(?, ?, ?, ?, ?)";
  const rInsertAccess = await promisePool
    .query(query, [dt, ctrlId, userId, state, request])
    .then(([rows, fields]) => {
      console.log("inserindo...");
      console.log(rows);
      return rows;
    })
    .catch((err) => {
      console.log("deu erro...");
      console.log(err);
      return err;
    });
}
exports.sendPush = function (subscription, title, body) {
  console.log("dentro do push");
  let obj = JSON.parse(subscription);
  let msg = { title: title, body: body };
  webpush.sendNotification(obj, JSON.stringify(msg), { TTL: 60 }); //sending
}
exports.stateBr = function (obj) {
  // traduz o campo state de EN para BR
  switch (obj) {
    case "granted":
      obj = "Liberado";
      break;
    case "blocked":
      obj = "Bloqueado";
      break;
    case "doublepass":
      obj = "Dupla passagem detectada!";
      break;
  }
  return obj;
}
exports.snapshot = function (dateTime, idController, cameraURL) {
  let ms = Date.now()
  let dest = `./snapshots/${dateTime}-${idController}.jpg`
  let url = cameraURL
  const file = fs.createWriteStream(dest);
  const request = http.get(url, function (response) {
    response.pipe(file);
    file.on('finish', function () {
      file.close();  // close() is async, call cb after close completes.
    });
  }).on('error', function (err) { // Handle errors
    fs.unlink(dest); // Delete the file async. (But we don't check the result)
  });

}
exports.controllersFrmCondo = async function (condoid) {
  let res = []
  const row = await promisePool
    .query("SELECT * FROM controllers WHERE condoid=?", [condoid])
    .then(([rows, fields]) => {
      console.log(rows);
      res = rows
    })
    .catch((err) => console.log(err));
  return res;
}

exports.userFrmId = async function (userId) {
  let res = false
  const row = await promisePool
    .query("SELECT * FROM users WHERE id=?", [userId])
    .then(([rows, fields]) => {
      //console.log(rows);
      if (rows.length > 0) res = rows[0]
    })
    .catch((err) => console.log(err));
  return res;
}

exports.userFrmQr = async function (qrcode) {
  let res = false
  const row = await promisePool
    .query("SELECT * FROM users WHERE qrcode=?", [qrcode])
    .then(([rows, fields]) => {
      //console.log(rows);
      if (rows.length > 0) res = rows[0]
    })
    .catch((err) => console.log(err));
  return res;
}

exports.updateUser = async function (userId, campo, valor) {
  let res = false
  const row = await promisePool
    .query(`UPDATE users SET ${campo}=? WHERE id=?`, [valor, userId])
    .then(([rows, fields]) => {
      console.log(rows);
      res = rows[0]
    })
  return res;
}

exports.utechAddUser = async function (controladora, usuario, visitante) {
  let res = false
  // controladora = {controllerIp, authUser, authPass}
  await axios
    .post(
      "http://" + controladora.ip + ":" + controladora.port + "/?request=adduser",
      {
        name: usuario.name,
        qrcode: usuario.qrcode,
        perm1: usuario.perm,
        lifecount: usuario.lifecount,
        key: usuario.key,
        visitor: visitante, //true or false
      },
      {
        withCredentials: true,
        auth: {
          username: controladora.user,
          password: controladora.password,
        },
      }
    )
    .then(function (response) {
      console.log(response);
      res = true;
    })
    .catch(function (error) {
      console.log(error);
      res = false;
      //adicionar registro na tabela pendencia ou deleteQrUser(qrcode);
    });
  return res;
}

exports.utechDelUser = async function (controladora, qrCode) {
  let res = false
  // controladora = {controllerIp, authUser, authPass}
  await axios
    .post(
      "http://" + controladora.controllerIp + "/?request=Deluser",
      {
        qrcode: qrCode,
      },
      {
        withCredentials: true,
        auth: {
          username: controladora.authUser,
          password: controladora.authPass,
        },
      }
    )
    .then(function (response) {
      console.log(response);
      res = true;
    })
    .catch(function (error) {
      console.log(error);
      res = false;
      //adicionar registro na tabela pendencia ou deleteQrUser(qrcode);
    });
  return res;
}

