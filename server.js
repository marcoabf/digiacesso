var moment = require("moment");
var randomstring = require("randomstring");
const mysql = require("mysql2");
var port = process.env.DB_PORT || 3306;
const webpush = require("web-push");
var nodemailer = require("nodemailer");
const pool = mysql.createPool({
  connectionLimit: 10,
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: "digiacesso",
  port: port,
});
const promisePool = pool.promise();
const axios = require("axios");

let transporter = nodemailer.createTransport({
  host: "smtp.uhserver.com",
  port: 587,
  secure: false, // upgrade later with STARTTLS
  auth: {
    user: "contato@accontrol.com.br",
    pass: "ctrl0400",
  },
});

const vapidKeys = {
  publicKey: "BMQhKi9b9wgTSELzr1dKaGtIcv1wXGH9TZuZ6I9s7OCLGCPlZrsBczpB2rasO6TCbDqvxh8hnzPOGu4C-IM7oXw",
  privateKey: "B_-NWqSNWz_Gh2WkzxbO5RY_kMymFj0LXzX9Tq4PH1g",
};
webpush.setVapidDetails("mailto:mb@accontrol.com.br", vapidKeys.publicKey, vapidKeys.privateKey);

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
  loginUser(req, res) {
    //-------- processo de login
    let username = req.body.username;
    let password = req.body.password;
    console.log(req.session);
    var query = "SELECT users.id, username, email, firstname, lastname, users.type, users.unit, ";
    query += " users.condoid , condos.name as condoName, controllers.id as ctrlID, controllers.name as ctrlName ";
    query += " from users, condos, controllers WHERE ";
    if (req.session.loggedin == true && req.session.userid) {
      query += " users.id=? AND users.condoid=condos.id AND users.condoid=controllers.condoid";
      pool.query(query, [req.session.userid], function (error, results, fields) {
        if (error) throw error;
        console.log(results);
        if (results.length > 0) {
          console.log("Dados de usuário recuperados.");
          res.send(results);
        }
      });
    } else if (username && password) {
      query += " users.username=? AND users.password=? AND users.condoid=condos.id AND users.condoid=controllers.condoid";
      pool.query(query, [username, password], function (error, results, fields) {
        if (error) throw error;
        console.log(results);
        if (results.length > 0) {
          console.log("Consulta do BD retornou registro.");
          console.log(req.sessionID);
          console.log(results[0].id);
          req.session.loggedin = true;
          req.session.username = username;
          req.session.userid = results[0].id;
          req.session.condoid = results[0].condoid;
          res.send(results);
        } else {
          res.send("Usuário ou senha incorretos!");
        }
      });
    } else {
      //quando não for passado o username e password
      res.send("Por favor, entre com um usuário e password.");
    }
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
      let dtc = moment().format("YYYY-MM-DD HH:mm:ss"); //horário atual .subtract(3, 'h')
      let key = randomstring.generate(8);
      key = key + userId;
      let link = "https://www.digiacesso.net/forgotpass/?link=" + key;
      let mailContent = "<h1> _digiACESSO </h1> <p> Como solicitado, segue o link para mudança de senha. <BR> ";
      mailContent += '<a href="' + link + '"> ' + link + "</a>";
      //when changing email then object = 1
      let query2 = "INSERT INTO pending (object, idobject, dtlimit, data) VALUES (1, ?, ?, ?)";
      const insertPendency = await promisePool
        .query(query2, [userId, dtc, key])
        .then(([rows, fields]) => {
          console.log("inserindo...");
          console.log(rows);
          var mailOptions = {
            from: '"digiACESSO" <contato@accontrol.com.br>',
            to: req.body.email,
            subject: "Mudança de senha",
            html: mailContent,
          };
          transporter.sendMail(mailOptions, function (error, info) {
            //enviando o email
            if (error) {
              console.log(error);
              res.send("Seu e-mail não pode ser enviado. Tente novamente.");
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
    let query = "SELECT * FROM pending WHERE data=?";
    if (link == null) link = "0";
    const rowUser = await promisePool
      .query(query, [link])
      .then(([rows, fields]) => {
        if (rows.length > 0) {
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
      let query = "UPDATE users SET password=? WHERE id=?";
      const rowInsert = await promisePool
        .query(query, [req.body.password, userId])
        .then(([rows, fields]) => {
          console.log(rows[0]);
        })
        .catch((err) => console.log(err));
    }
  },
  async changePass(req, res) {
    // ---- mudança de senha dentro da aplicaçao
    console.log("mudando a senha dentro do app...");
    let query = "UPDATE users SET password=? WHERE id=?";
    const rowInsert = await promisePool
      .query(query, [req.body.password, req.session.userid])
      .then(([rows, fields]) => {
        console.log(rows[0]);
        res.send("Senha alterada!");
      })
      .catch((err) => {
        console.log(err);
        res.send("Não foi possível alterar a senha!");
      });
  },
  async utech(req, res) {
    //------utech ---- recebimento de eventos das controladoras (apenas utech)
    console.log("utech");
    console.log(req.headers);
    console.log("query:");
    console.log(req.query);
    let request = req.query.request,
      dataHora = moment().format();
    let idUser = 0,
      responsible = 0,
      controllerId = 0,
      condoId = 0;
    let notifyR = 0; //tipo de notificação que o receptor pode receber
    let notifyV = 0; //tipo de notificação definida na definição do visitante
    let firstname = "";
    let cHead = req.headers["user-agent"]; //user-agent -> numero de série da controladora e ID
    let cArray = cHead.split("/");
    let marca = cArray[0];
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
    const rowFindController = await promisePool //selecionando a controladora
      .query("SELECT * FROM controllers WHERE brand='utech' AND serial = ?", [serial])
      .then(([rows, fields]) => {
        controllerId = rows[0].id;
        console.log("controladora:");
        console.log((controllerId = rows[0].id));
        condoId = rows[0].condoid;
      })
      .catch((err) => {
        console.log(err);
      });
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
            sendPush(sindicos[i].subscription, "Alarme", "Tentativa de arrombamento detectado!");
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
      console.log("QRcode::");
      var qrcode = req.query.qrcode;
      console.log(qrcode);
      // Seleciona o usuário (ou Visitante) que passou o QR Code
      const rowFindUser = await promisePool
        .query("SELECT id, firstname, responsible, type, notify FROM users WHERE qrcode = ?", [qrcode])
        .then(([rows, fields]) => {
          //console.log(rows);
          idUser = rows.length > 0 ? rows[0].id : 0;
          firstname = rows.length > 0 ? rows[0].firstname : "QrCode não reconhecido";
          responsible = rows.length > 0 ? rows[0].responsible : "0";
          notifyV = rows.length > 0 ? rows[0].notify : 0;
          console.log("user: " + idUser);
        })
        .catch((err) => console.log(err));
      // Insere dados do acesso
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

      //seleciona o usuário responsável pelo visitante
      let subscription = "";
      const rowSubs = await promisePool
        .query("SELECT subscription, notify, email FROM users WHERE id=?", [responsible])
        .then(([rows, fields]) => {
          if (rows.length > 0) {
            subscription = rows[0].subscription;
            notifyR = rows[0].notify;
            emailR = rows[0].email;
          }
        })
        .catch((err) => console.log(err));
      console.log(subscription);

      // enviando webpush ou email apenas se for um visitante
      if (responsible > 0) {
        let obj = JSON.parse(subscription);
        let body = firstname + ": Acesso: " + stateBr(req.query.state);
        let msg = { title: "digiACESSO", body: body };
        webpush.sendNotification(obj, JSON.stringify(msg), { TTL: 60 }); //sending
        if (notifyR == 2 || notifyR == 3) {
          //enviar email
          var mailOptions = {
            from: '"digiACESSO" <contato@accontrol.com.br>',
            to: emailR,
            subject: body,
            html: `digiACESSO <br> Email informativo. Não responder <br> Detectado Acesso: <br> ${body}`,
          };
          transporter.sendMail(mailOptions, function (error, info) {
            //enviando o email
            if (error) {
              console.log(error);
              console.log("E-mail não pode ser enviado. Tente novamente.");
            } else {
              console.log("Email sent: " + info.response);
              console.log("E-mail enviado com sucesso!");
            }
          });
        }
      }
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
    query = "SELECT * FROM users WHERE responsible=? AND type<10 ORDER BY dtcreated DESC"; //dados dos visitantes from user;
    pool.query(query, [req.body.userID], function (error, results, fields) {
      if (error) throw error;
      res.send(results);
    });
  },
  addGuest(req, res) {
    console.log("addGuest");
    //padrao do qrcode: userID-X-YYYY-Z onde YYYY é um número aleatório e X é tipo de usuário
    qrcode = randomstring.generate(6); //gera uma string randomica de 6 caracteres
    qrcode = req.body.responsible + "-" + req.body.type + "-" + qrcode;
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
    let dtc = moment().subtract(3, "h").format("YYYY-MM-DD HH:mm:ss");
    pool.query("SELECT * FROM users WHERE qrcode=?", [qrcode], function (error, result, fields) {
      if (error) throw error;
      repet = Number(result.length) + 1;
      qrcode += "-" + repet; // cria um diferenciador caso exista um qrcode igual
      query = "INSERT INTO users (firstname, condoid, unit, type, responsible, perm, qrcode, dtcreated) ";
      query += " VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
      pool.query(query, [name, req.body.condoid, req.body.unit, req.body.type, req.body.responsible, perm, qrcode, dtc], function (
        error,
        results,
        fields
      ) {
        if (error) throw error;
        console.log(results);
      });
      query = "SELECT * FROM controllers WHERE condoid=?"; //buscar dados das controladoras;
      pool.query(query, [req.body.condoid], function (error, results, fields) {
        if (error) throw error;
        for (let i = 0; i < results.length; i++) {
          controllerIp = results[i].ip;
          authUser = results[i].user;
          authPass = results[i].password;
          console.log(authUser);
          console.log("enviando para utech");
          if (typeof controllerIp == "string") {
            //se existir IP entao cadastra
            axios
              .post(
                "http://" + controllerIp + "/?request=adduser",
                {
                  name: name,
                  qrcode: qrcode,
                  perm1: perm,
                  lifecount: req.body.lifecount,
                  visitor: true,
                  key: key,
                },
                {
                  withCredentials: true,
                  auth: {
                    username: authUser,
                    password: authPass,
                  },
                }
              )
              .then(function (response) {
                console.log(response);
                res.send(qrcode);
              })
              .catch(function (error) {
                console.log(error);
                res.send("error");
                //adicionar registro na tabela pendencia ou deleteQrUser(qrcode);
              });
            //console.log (response.data);
          } // fim do if
        } // fim do for
      });
    });
  }, // fim do addGuest
  async delGuest(req, res) {
    console.log("delete");
    console.log(req.session.condoid);
    const row = await promisePool
      .query("SELECT * FROM controllers WHERE condoid=?", [req.session.condoid])
      .then(([rows, fields]) => {
        console.log(rows);
        controllerIp = rows[0].ip;
        authUser = rows[0].user;
        authPass = rows[0].password;
        xRows = rows.length;
      })
      .catch((err) => console.log(err));
    console.log(xRows);
    var x = 0,
      y = 0;
    while (x < xRows) {
      try {
        const response = await axios.post(
          "http://" + controllerIp + "/?request=deluser",
          {
            qrcode: req.body.qrcode,
          },
          {
            withCredentials: true,
            auth: {
              username: authUser,
              password: authPass,
            },
          }
        );
        console.log("delete sent successful to utech");
        console.log(response);
        y += 1;
      } catch (error) {
        if (error.response.status == 400) {
          y += 1;
        }
        console.error(error.response.status);
      }
      x += 1;
    }
    if (y == xRows) {
      //tipos entre 11 e 19 são usuários desabilitados
      const row1 = await promisePool.query("UPDATE users SET type=type+10 WHERE qrcode=?", [req.body.qrcode]);
      console.log(row1);
      res.send("Dados excluídos com sucesso!");
    } else {
      res.send("Não foi possível excluir os dados em todos os acessos! Tente novamente.");
    }
  },
  async openDoor(req, res) {
    // comando para abrir porta
    let ctrlId = req.body.ctrlID;
    console.log(ctrlId);
    let request = req.body.origem; // info para a tabela access
    let state = "granted"; // info para a tabela access
    let ctrlData = {};
    let userId = req.body.userid;
    console.log("session-userid");
    console.log(req.session.userid);
    const result = await promisePool //buscando dados da controladora que receberá o comando
      .query("SELECT * FROM controllers WHERE id=?", [ctrlId])
      .then(([rows]) => {
        ctrlData = rows[0];
        console.log(rows[0].ip + ":" + rows[0].user + ":" + rows[0].password);
      })
      .catch((err) => {
        console.log(err);
      });
    console.log("enviando requisição");
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
        let dt = moment().format();
        console.log("inserindo acesso na tabela");
        const ins = insertAccess(dt, ctrlId, userId, state, request);
        res.send("Comando enviado!");
      })
      .catch(function (error) {
        console.log(error);
        res.send("Erro ao enviar requisição.");
      }); // axios.get
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
      "SELECT datetime, users.firstname as firstname, users.lastname as lastname, users.unit, users.responsible, request, state, r.firstname as rName ";
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
    console.log(req.session.id);
    console.log(req.session.userid);
    if (!isValidSaveRequest(req, res)) {
      return;
    }
    console.log("É VÁLIDO!");
    strBody = JSON.stringify(req.body);
    query = "UPDATE users SET subscription=? WHERE id=?";
    pool.query(query, [strBody, req.session.userid], function (error, results, fields) {
      if (error) throw error;
      console.log(results);
      res.setHeader("Content-Type", "application/json");
      res.send(JSON.stringify({ success: true }));
    });
  },
  sendTestNotification(req, res) {
    query = "SELECT * FROM users WHERE id=?";
    pool.query(query, [req.session.userid], function (error, results) {
      if (error) throw error;
      console.log("Enviando Noticação");
      if (results.length > 0) {
        let subscription = results[0].subscription;
        let obj = JSON.parse(subscription);
        delete obj.expirationTime;
        subscription = JSON.stringify(obj);
        console.log(subscription);
        let msg = { title: "digiACESSO", body: "Notificação em funcionamento" };
        webpush
          .sendNotification(obj, JSON.stringify(msg), { TTL: 60 }) //sending
          .catch((err) => {
            if (err.statusCode === 404 || err.statusCode === 410) {
              console.log("Subscription has expired or is no longer valid: ", err);
              //return deleteSubscriptionFromDatabase(subscription._id);
            } else {
              throw err;
            }
          });
        res.send("Notificação enviada!");
        return;
      }
      res.send("Usuário não encontrado!");
    });
  },
}; // fim do export
//-------------------------------------------------------------

async function insertAccess(dt, ctrlId, userId, state, request) {
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
function sendPush(subscription, title, body) {
  console.log("dentro do push");
  let obj = JSON.parse(subscription);
  let msg = { title: title, body: body };
  webpush.sendNotification(obj, JSON.stringify(msg), { TTL: 60 }); //sending
}
function stateBr(obj) {
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
