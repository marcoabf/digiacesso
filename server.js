
const mysql = require('mysql');
var moment = require('moment'); 
var port = process.env.DB_PORT || 3306;
const pool = mysql.createPool({
  connectionLimit : 10,
  host     : 'mysql669.umbler.com',
  user     : 'dbmaster',
  password : 'inspiron,25',
  database : 'controlweb',
  nestTables: '_',
  port: port
});
const axios = require('axios');
//var row = [];

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
    let query = 'SELECT datetime, firstname, lastname, state ';
    query += ' FROM access, users, controllers  WHERE users.responsible=? ';
    query += ' AND users.id=access.userid AND access.controllerid=controllers.id ORDER BY datetime';
    pool.query(query, [userID], function (error, results, fields) {
      if (error) throw error;
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
    var dt = moment(req.headers.date);
    dt = moment(dt, "DD-MM-YYYY  HH:mm:ss");
    if (req.query.request == "user") {
      console.log("User");
      let x = 0
      while (serial.charAt(x)==='0'){ x+=1; }
      serial = serial.slice(x,serial.length);
    } // fim user
    if (req.query.request == "qrcode") { 
      //acesso via qrcode - padrao do qrcode: RESPONSIBLE-X-YYYY onde yyyy é um número aleatório e x é tipo de usuário
      console.log("QRcode");
      qrcode = req.query.qrcode;
      qrArray = qrcode.split("-");
      query = 'SELECT id FROM users WHERE qrcode=?';
      pool.query(query, [qrcode], function (error, results, fields) {
        if (error) throw error;
        idUser = (results.length>0) ? results[0].id : 0;
      });

      pool.query('INSERT INTO access("datetime", "controllerid", "userid", state, request) VALUES(?, ?, ?, ?, ?)', 
      [dt, serial, idUser, req.query.state, req.query.request], (error, result) => {   
        if (error) throw error;
        console.log(result);
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
    qrcode = Math.floor((Math.random() * 10000) + 1);
    qrcode = req.body.responsible + '-' + req.body.type +'-'+ qrcode;
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
      qrcode += '-' + repet; // cria um diferenciador caso exista um qrcode igual
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
  }

} // fim do export
//-------------------------------------------------------------

function deleteQrUser(qrcode){
  query = "DELETE FROM users WHERE qrcode=?";
  pool.query(query,[qrcode], function (error, results, fields) {
    if (error) throw error; 
    console.log(results);
  });
      
}  
function formatDate(dt) {
  dia  = dt.getDate().toString();
  mes  = (dt.getMonth()+1).toString(); //+1 pois no getMonth Janeiro começa com zero.
  hora = dt.getHours().toString();
  min = dt.getMinutes().toString(); 
  seg = dt.getSeconds().toString();  
  dd = (dia.length == 1) ? '0' + dia : dia;
  mm = (mes.length == 1) ? '0' + mes : mes;
  yyyy = dt.getFullYear();
  hh = (hh>=3) ? hh-3 : hh + 24 - 3;
  hh = (hora.length == 1) ? '0' + hora : hora;
  mn = (min.length==1) ? '0' + min : min;
  ss = (seg.length == 1) ? '0' + seg : seg;
  dateTime = yyyy+mm+dd+hh+mn+ss;
  return dateTime;
}