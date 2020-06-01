var moment = require('moment'); 
var randomstring = require('randomstring');
const mysql = require('mysql2');
var port = process.env.DB_PORT || 3306;
const webpush = require('web-push');
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
//var row = [];
const vapidKeys = {
    publicKey:'BIwuuXK7vJ_QvxDTmOp-sLDkCRV8gZJst02gtPg5C4KhgqUoD9_UuY1T3yzacCqnSN6GGpx4WhKku_GX65T-rhA',
    privateKey: 'pVfFaI0B9yPezKupI7LpRByiKqoN4i480HJae4UJiyw'
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
  
  const triggerPushMsg = function(subscription, dataToSend) {
    return webpush.sendNotification(subscription, dataToSend)
    .catch((err) => {
      if (err.statusCode === 404 || err.statusCode === 410) {
        console.log('Sua inscrição expirou ou não é mais válida: ', err);
        //return deleteSubscriptionFromDatabase(subscription._id);
      } 
      else {
        throw err;
      }
    });
  };

module.exports = {
  //-----------------------------qLogin
   qLogin(req, res) {
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
          req.session.loggedin = true;
          req.session.username = username;   
          req.session.userid = results[0].id;
          res.send(results);
        } else { res.send("Usuário ou senha incorretos!"); }
      });
    } 
    else { //quando não for passado o username e password
      res.send('Por favor, entre com um usuário e password.');
    }
  },
   access(req, res){ // Mostra a lista de acessos
    console.log('Access');
    let userID = req.body.userID;
    console.log(userID);
    let query = 'SELECT datetime, firstname, lastname, state ';
    query += ' FROM access, users, controllers  WHERE users.responsible=? ';
    query += ' AND users.id=access.userid AND access.controllerid=controllers.id ORDER BY datetime';
    pool.query(query, [userID], function (error, results, fields) {
      if (error) throw error;
      console.log(results);
      if (results.length>0) res.send(results); else res.send("Sem registros de acesso!");
    });
   },
  //-------------------------------------------doLogout - verifying login
  doLogout(req, res){
    console.log(req.session.username);
    console.log(req.session.id);  
    req.session.userid = '';
    req.session.loggedin = false;
    res.end();
  },  
  //------------------------utech ---- recebimento de eventos das controladoras
  utech(req, res){
    console.log("utech");
    console.log('headers:');
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
      pool.query("SELECT id FROM users WHERE qrcode = ?", [qrcode], function (error, results) {
        if (error) throw error;
        console.log(results);
        idUser = (results.length>0) ? results[0].id : 0;
        console.log('user: '+idUser);
        query='INSERT INTO access(datetime, controllerid, userid, state, request) VALUES(?, ?, ?, ?, ?)';
        pool.query(query, [req.query.time, serial, idUser, req.query.state, req.query.request], (error, result) => {   
          if (error) throw error;
          console.log(result);
        }); 
      });
    } //fim qrCode
    res.status(200).end();
  }, //---------------------utech
  guests(req, res){
    //lista visitantes
    query = "SELECT * FROM users WHERE responsible=?";  //buscar dados das controladoras;
    pool.query(query,[req.body.userID], function (error, results, fields) {
      if (error) throw error;  
      res.send(results);  
    });
  },
  addGuest(req, res){
    //padrao do qrcode: userID-X-YYYY-Z onde YYYY é um número aleatório e X é tipo de usuário
    lifecount = req.body.lifecount;
    //qrcode = Math.floor((Math.random() * 10000) + 1);
    qrcode = randomstring.generate(6);
    qrcode = req.body.responsible + ' ' + req.body.type +' '+ qrcode;
    let name = req.body.name;
    let validity = req.body.validity *60*60*24;
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
      qrcode += ' ' + repet; // cria um diferenciador caso exista um qrcode igual
      query = "INSERT INTO users (firstname, condoid, type, responsible, validity, perm, qrcode, dtcreated) ";
      query +=" VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
      pool.query(query,[name, req.body.condoid, req.body.type, req.body.responsible, validity, perm, qrcode, dtc], function (error, results, fields) {
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
              validity: validity,
              perm1: perm,
              lifecount: lifecount,
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
              console.log(response.data);
              res.send(qrcode);
            })
            .catch(function (error) {
              console.log(error);
              res.send('error');
              deleteQrUser(qrcode);
          });
          //console.log (response.data);
        } // fim do if
      });
    });
  }, // fim do addGuest
  async delGuest(req, res) {
    console.log('delete');
    const row1 = await promisePool.query('DELETE FROM users WHERE qrcode=?',[req.body.qrcode]);
    console.log(row1);
    controllerIp = '192.168.1.99';
    authUser = 'admin';
    authPass = 'admin';
    console.log("antes da requisição utech...")
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
      console.log("delete sent to utech");
      console.log(response);
      res.send("Dados excluídos com sucesso!");
    } catch (error) {
      console.error(error);
    }
    
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
  webPush(req, res) {
    console.log("webpush:");
    console.log(req.body);
    if (!isValidSaveRequest(req, res)) {
      return;
    }
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
      if (results.length>0) {
        let subscription = results[0].subscription;
        let obj = JSON.parse(subscription);
        delete obj.expirationTime;
        subscription = JSON.stringify(obj);
        console.log(subscription);
        webpush.sendNotification(obj, 'Um visitante chegou!')
          .catch((err) => {
            if (err.statusCode === 404 || err.statusCode === 410) {
              console.log('Subscription has expired or is no longer valid: ', err);
              return deleteSubscriptionFromDatabase(subscription._id);
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

