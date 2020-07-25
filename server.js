var moment = require('moment'); 
var randomstring = require('randomstring');
const mysql = require('mysql2');
var port = process.env.DB_PORT || 3306;
const webpush = require('web-push');
var nodemailer = require('nodemailer');
const pool = mysql.createPool({
  connectionLimit : 10,
  host     : 'mysql669.umbler.com',
  user     : 'masterdbuser',
  password : 'inspiron,25',
  database : 'digiacesso',
  port: port
});
const promisePool = pool.promise();
const axios = require('axios');


const vapidKeys = {
  publicKey:'BMQhKi9b9wgTSELzr1dKaGtIcv1wXGH9TZuZ6I9s7OCLGCPlZrsBczpB2rasO6TCbDqvxh8hnzPOGu4C-IM7oXw',
  privateKey: 'B_-NWqSNWz_Gh2WkzxbO5RY_kMymFj0LXzX9Tq4PH1g'
};
webpush.setVapidDetails(
    'mailto:mb@accontrol.com.br',
    vapidKeys.publicKey,
    vapidKeys.privateKey
  );

  const isValidSaveRequest = (req, res) => { // verifica se a requisição possui endpoint.
    console.log(req.body.endpoint);
    if (!req.body || !req.body.endpoint) {
      // Not a valid subscription.
      res.status(400);
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify({
        error: {
          id: 'no-endpoint',
          message: 'Subscription must have an endpoint.'
        }
      }));
      return false; // retorna falso (não é uma requisição valida)
    }
    return true; // true: é uma requisição válida
  };
  

module.exports = {
   qLogin(req, res) {  //-------- processo de login
    let username = req.body.username;
    let password = req.body.password;
    console.log(req.session);
    var query = 'SELECT users.id, username, email, firstname, lastname, users.type, users.unit, '
    query += ' users.condoid , condos.name as condoName, controllers.id as ctrlID, controllers.name as ctrlName ';
    query += ' from users, condos, controllers WHERE ';
    if (req.session.loggedin == true && req.session.userid) {
      query += ' users.id=? AND users.condoid=condos.id AND users.condoid=controllers.condoid'
      pool.query(query, [req.session.userid], function (error, results, fields) {
        if (error) throw error;
        console.log(results); 
        if (results.length>0) {
          console.log ("Dados de usuário recuperados.");
          res.send(results);
        }
      });
    } 
    else if(username && password) {
      query += ' users.username=? AND users.password=? AND users.condoid=condos.id AND users.condoid=controllers.condoid'
      pool.query(query, [username, password],  function (error, results, fields) {
        if (error) throw error;
        console.log(results); 
        if (results.length>0) {
          console.log ("Consulta do BD retornou registro.");
          console.log(req.sessionID); 
          console.log(results[0].id);
          req.session.loggedin = true;
          req.session.username = username;   
          req.session.userid = results[0].id;
          req.session.condoid =  results[0].condoid;
          res.send(results);
        } else { res.send("Usuário ou senha incorretos!"); }
      });
    } 
    else { //quando não for passado o username e password
      res.send('Por favor, entre com um usuário e password.');
    }
  },
  doLogout(req, res){  //----- processo de logout
    console.log(req.session.username);
    console.log(req.session.id);  
    req.session.userid = '';
    req.session.loggedin = false;
    res.end();
  }, 
  async mail2NewPassword(req, res){
    //if (isEmail(req.body.email)) {} //checa se o formato de email é aceito
    var userId;
    var transporter = nodemailer.createTransport({
      host: "smtp.uhserver.com",
      port: 587,
      secure: false, // upgrade later with STARTTLS
      auth: {
        user: "contato@accontrol.com.br",
        pass: "ctrl0400"
      }
    });
    
    let query = 'SELECT * FROM users WHERE email=?';
    const rowUser = await promisePool.query(query,[req.body.email])
      .then( ([rows,fields]) => { 
        console.log(rows.length);
        if (rows.length>0) { 
          userId = rows[0].id;          
        } else {
          res.send("Este e-mail não está cadastrado para nenhum usuário.");
        }
      })
      .catch(err => console.log(err));
    if (userId != null) {
      let dtc = moment().format("YYYY-MM-DD HH:mm:ss"); //horário atual .subtract(3, 'h')
      let key = randomstring.generate(8);
      key = key + userId;
      let link = 'https://www.digiacesso.net/forgotpass/?link=' + key;
      let mailContent = '<h1> _digiACESSO </h1> <p> Como solicitado, segue o link para mudança de senha. <BR> ';
      mailContent += '<a href="' + link + '"> ' + link + '</a>';
      //when changing email then object = 1 
      let query2 = "INSERT INTO pending (object, idobject, dtlimit, data) VALUES (1, ?, ?, ?)";
      const insertPendency = await promisePool.query(query2, [userId, dtc, key])
        .then( ([rows,fields]) => { 
          console.log('inserindo...');
          console.log(rows);
          var mailOptions = {
            from: '"digiACESSO" <contato@accontrol.com.br>',
            to: req.body.email,
            subject: 'Mudança de senha',
            html: mailContent
          };
          transporter.sendMail(mailOptions, function(error, info){ //enviando o email
            if (error) {
              console.log(error);
              res.send("Seu e-mail não pode ser enviado. Tente novamente.");
            } else {
              console.log('Email sent: ' + info.response);
              res.send("E-mail enviado com sucesso!");
            }
          });
        })
        .catch(err => console.log(err));
    }
  }, 
  async forgotPass(req, res) { // ---- requisição de novo password 
    console.log("verificando a requisição de mudança de senha...");
    var update = false;
    var link= req.query.link; // pega parametro link da requisição get
    if (req.body.data!=null) { link = req.body.data; } // pega parametro link da requisição post
    let query = 'SELECT * FROM pending WHERE data=?';
    if (link == null) link='0';
      const rowUser = await promisePool.query(query,[link])
        .then( ([rows,fields]) => { 
          if (rows.length>0) { 
            let timeLimit = moment().subtract(10, 'm').format("YYYY-MM-DD HH:mm:ss"); // limit p/ mudar a senha: 10 minutos
            var date1 = rows[0].dtlimit + ""; 
            var date2 = date1.split(".");
            date1 = date2[0];
            console.log(timeLimit);
            console.log (date1);  
            if (moment(timeLimit).isAfter(date1)) {
              console.log('isAfter');
              res.send('Sessão expirada. Faça uma nova solicitação.');
            } else if (req.body.password==null) {
              console.log('isBefore'); 
              res.redirect('../pass.html?data='+ link); 
            } else { update = true; } // se password != null então senha pode ser atualizada
          } else {
            console.log("Não foi possível identificar a requisição.");
          }
        })
        .catch(err => console.log(err));
    if (update === true) { 
      console.log("update true");
      let userId = req.body.data.slice(8);
      let query = "UPDATE users SET password=? WHERE id=?";
      const rowInsert = await promisePool.query(query,[req.body.password, userId])
      .then( ([rows,fields]) => { 
        console.log(rows[0]);
      })
      .catch(err => console.log(err));
    }
  },
  async changePass(req, res) { // ---- requisição de novo password dentro da aplicaçao
    console.log("mudando a senha dentro do app...");
    let query = "UPDATE users SET password=? WHERE id=?";
    const rowInsert = await promisePool.query(query,[req.body.password, req.session.userid])
      .then( ([rows,fields]) => { 
        console.log(rows[0]);
        res.send("Senha alterada!")
      })
        .catch(err => {console.log(err); res.send("Não foi possível alterar a senha!")});
  },
  async utech(req, res){  //------utech ---- recebimento de eventos das controladoras
    console.log("utech");
    console.log(req.headers);
    console.log('query:');
    console.log(req.query);
    cHead = req.headers["user-agent"]; //user-agent -> numero de série da controladora e ID
    cArray = cHead.split("/");
    marca = cArray[0];
    serial = cArray[1];
    let x = 0
    while (serial.charAt(x)==='0'){ x+=1; }
    serial = serial.slice(x,serial.length);
    console.log(serial);
    if (req.query.request == "qrcode") { 
      console.log("QRcode");
      qrcode = req.query.qrcode;
      console.log(qrcode);
      const rowFindUser = await promisePool.query("SELECT id, firstname, responsible FROM users WHERE qrcode = ?", [qrcode])
        .then( ([rows,fields]) => { 
          console.log(rows);
          idUser = (rows.length>0) ? rows[0].id : 0;
          firstname = (rows.length>0) ? rows[0].firstname: 'QrCode não reconhecido';
          resp = (rows.length>0) ? rows[0].responsible: '0';
          console.log('user: '+idUser);
        })
        .catch(err => console.log(err));
      var subscription =  '';
      const rowSubs = await promisePool.query('SELECT subscription FROM users WHERE id=?',[resp])
        .then( ([rows,fields]) => { subscription = rows[0].subscription; })
        .catch(err => console.log(err));
        console.log(subscription);
      query='INSERT INTO access(datetime, controllerid, userid, state, request) VALUES(?, ?, ?, ?, ?)';
      const rInsertAccess = await promisePool.query(query, [req.query.time, serial, idUser, req.query.state, req.query.request])
        .then( ([rows,fields]) => {console.log(rows);})
        .catch(err => console.log(err));

      let obj = JSON.parse(subscription);
      let body = firstname + ": Acesso: " + stateBr(req.query.state);
      let msg = {title: "digiACESSO", body: body};
      webpush.sendNotification(obj, JSON.stringify(msg), {TTL: 60}); //sending
    } //fim qrCode
    res.status(200).end();
  }, //---------------------utech
  guests(req, res){
    //lista visitantes
    query = "SELECT * FROM users WHERE responsible=? AND type<10 ORDER BY dtcreated DESC" ;  //dados dos visitantes from user;
    pool.query(query,[req.body.userID], function (error, results, fields) {
      if (error) throw error;  
      res.send(results);  
    });
  },
  addGuest(req, res){
    console.log("addGuest");
    //padrao do qrcode: userID-X-YYYY-Z onde YYYY é um número aleatório e X é tipo de usuário
    qrcode = randomstring.generate(6); //gera uma string randomica de 6 caracteres
    qrcode = req.body.responsible + '-' + req.body.type +'-'+ qrcode;
    let name = req.body.name;
    let hIn = req.body.hinicial;
    let hOut = req.body.hfinal;
    name = (name=='')?'Sem nome':name;
    console.log(name);
    hIn = hIn.toString;
    hIn = (hIn.length==1)?'0'+hIn:hIn;
    hOut = hOut.toString;
    hOut = (hOut.length==1)?'0'+hOut:hOut;
    let perm = req.body.days +" "+ req.body.hinicial + ":00-" + req.body.hfinal + ":59";
    let key = req.body.responsible;
    let dtc = moment().subtract(3, 'h').format("YYYY-MM-DD HH:mm:ss");
    pool.query('SELECT * FROM users WHERE qrcode=?',[qrcode], function (error, result, fields) {
      if (error) throw error;
      repet = Number(result.length) + 1;
      qrcode += '-' + repet; // cria um diferenciador caso exista um qrcode igual
      query = "INSERT INTO users (firstname, condoid, type, responsible, perm, qrcode, dtcreated) ";
      query +=" VALUES (?, ?, ?, ?, ?, ?, ?)";
      pool.query(query,[name, req.body.condoid, req.body.type, req.body.responsible, perm, qrcode, dtc], function (error, results, fields) {
        if (error) throw error;  
        console.log(results);
      });
      query = "SELECT * FROM controllers WHERE condoid=?";  //buscar dados das controladoras;
      pool.query(query,[req.body.condoid], function (error, results, fields) {
        if (error) throw error;  
        controllerIp = results[0].ip;
        authUser = results[0].user;
        authPass = results[0].password;
        console.log(authUser);
        console.log("enviando para utech"); 
        if (typeof controllerIp =='string') { 
          axios.post('http://'+controllerIp+'/?request=adduser', {
              name: name,
              qrcode: qrcode,
              perm1: perm,
              lifecount: req.body.lifecount,
              visitor: true,
              key: key
            },
            { withCredentials: true,  
              auth: {
                    username: authUser,
                    password: authPass
                    }
            })
            .then(function (response) {
              console.log(response);
              res.send(qrcode);
            })
            .catch(function (error) {
              console.log(error);
              res.send('error');
              //deleteQrUser(qrcode);
          });
          //console.log (response.data);
        } // fim do if
      });
    });
  }, // fim do addGuest
  async delGuest(req, res) {
    console.log('delete');
    console.log(req.session.condoid);
    const row = await promisePool.query('SELECT * FROM controllers WHERE condoid=?',[req.session.condoid])
    .then( ([rows,fields]) => {
      console.log(rows);
      controllerIp = rows[0].ip;
      authUser = rows[0].user;
      authPass = rows[0].password;
      xRows = rows.length;
    })
    .catch(err => console.log(err));
    console.log(xRows);
    var x = 0, y = 0;
    while (x < xRows) {
      try {
        const response = await axios.post('http://'+controllerIp+'/?request=deluser', {
          qrcode: req.body.qrcode
        },
        { withCredentials: true,  
          auth: {
                username: authUser,
                password: authPass
                }
        });
        console.log("delete sent successful to utech");
        console.log(response);
        y += 1;
      } catch (error) {
        if (error.response.status == 400) {y += 1}
        console.error(error.response.status);
      }
      x+=1;
    }
    if (y == xRows) {
      //tipos entre 11 e 19 são usuários desabilitados
      const row1 = await promisePool.query('UPDATE users SET type=type+10 WHERE qrcode=?',[req.body.qrcode]);
      console.log(row1);
      res.send("Dados excluídos com sucesso!");
    } else { res.send("Não foi possível excluir os dados em todos os acessos! Tente novamente.")}
  },
  openDoor(req, res){ // comando para abrir porta
    ctrlId = req.body.ctrlID;
    pool.query("SELECT * FROM controllers WHERE id=?",[ctrlId], function (error, result) {
      if (error) throw error;  
      console.log(result[0].ip+':'+result[0].user +':'+ result[0].password)
      axios.get('http://'+result[0].ip+'/?request=relay&interface=0&state=on', 
        { withCredentials: true,  
          auth: {
                username: result[0].user,
                password: result[0].password
                }
        })
      .then(function (response) {
        console.log(response); 
        res.send("Comando enviado!");
      })
      .catch(function (error) { 
        console.log(error);  
        res.send("Erro ao enviar requisição.");
      }); // axios.get
    });   //query
  },
  access(req, res){ // Mostra a lista de acessos
    console.log('Access');
    let userID = req.body.userID;
    console.log(userID);
    let query = 'SELECT datetime, firstname, lastname, state ';
    // type<10 -> apenas usuários ativos
    query += ' FROM access, users, controllers  WHERE users.responsible=? ';
    query += ' AND users.id=access.userid AND access.controllerid=controllers.id ORDER BY datetime DESC ';
    query += 'LIMIT 0, ?'
    pool.query(query, [userID, req.body.limit], function (error, results, fields) {
      if (error) throw error;
      console.log(results);
      if (results.length>0) res.send(results); else res.send("Sem registros de acesso!");
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
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify({ success: true } )); 
    });
  },
  sendTestNotification(req, res) {
    query = 'SELECT * FROM users WHERE id=?';
    pool.query(query, [req.session.userid], function (error, results) {
      if (error) throw error;
      console.log("Enviando Noticação");
      if (results.length>0) {
        let subscription = results[0].subscription;
        let obj = JSON.parse(subscription);
        delete obj.expirationTime;
        subscription = JSON.stringify(obj);
        console.log(subscription);
        let msg = {title: "digiACESSO", body:"Notificação em funcionamento"};
        webpush.sendNotification(obj, JSON.stringify(msg), {TTL: 60}) //sending
        .catch((err) => {
          if (err.statusCode === 404 || err.statusCode === 410) {
            console.log('Subscription has expired or is no longer valid: ', err);
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
  }
} // fim do export
//-------------------------------------------------------------

function stateBr (obj) { // traduz o campo state de EN para BR
  switch (obj) {
    case 'granted': obj = "Liberado"; break;
    case 'blocked': obj = "Bloqueado"; break;
    case 'doublepass': obj = "Dupla passagem detectada!"; break;
  }
  return obj;
}