var moment = require("moment");
const mysql = require("mysql2");
var port = process.env.DB_PORT || 3306;

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
const { NULL } = require("mysql2/lib/constants/types");

module.exports = {
  loginAdmin(req, res) {
    //-------- processo de login dos administradores do sistema
    let username = req.body.username;
    let password = req.body.password;
    console.log("parametros post:");
    console.log(req.body);
    var query = "SELECT admin_users.id, username, admin_users.email, admin_users.name, admin_users.type, ";
    query += " company_condo.idcompany, company_condo.idcondo, company.name as company, condos.name as condominio ";
    query += ", condos.address FROM admin_users, company_condo, company, condos WHERE ";
    if (req.session.adminLoggedIn == true && req.session.adminId) {
      query += " admin_users.id=? AND admin_users.idcompany=company_condo.idcompany";
      query += " AND admin_users.idcompany=company.id AND company_condo.idcondo = condos.id";
      pool.query(query, [req.session.adminId], function (error, results) {
        if (error) throw error;
        console.log(results);
        if (results.length > 0) {
          console.log("Dados de usuário recuperados.");
          res.send(results);
        }
      });
    } else if (username && password) {
      query += " admin_users.username=? AND admin_users.password=? ";
      query += " AND admin_users.idcompany=company_condo.idcompany ";
      query += " AND admin_users.idcompany=company.id AND company_condo.idcondo = condos.id ";
      pool.query(query, [username, password], function (error, results, fields) {
        if (error) throw error;
        console.log(results);
        if (results.length > 0) {
          console.log("Consulta do BD retornou registro.");
          console.log(req.sessionID);
          console.log(results[0].id);
          req.session.adminLoggedIn = true;
          req.session.username = username;
          req.session.adminId = results[0].id;
          req.session.companyId = results[0].idcompany;
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
  // envia array de usuários do condomínio ordenado por unidade (casa) from vueAdmin.js
  async condoUnits(req, res) {
    if (req.session.adminId != undefined) {
      console.log("sessao ok");
      let condoId = req.body.condoId;
      let query = "SELECT * FROM users WHERE condoid=? AND responsible IS NULL ORDER BY unit";
      const result = await promisePool
        .query(query, [condoId])
        .then(([rows, fields]) => {
          res.send(rows);
        })
        .catch((err) => {
          console.log(err);
          res.send("Não foi possível acessar as unidades!");
        });
    }
  },
  async condoEquipments(req, res) {
    if (req.session.adminId != undefined) {
      let condoId = req.body.condoId;
      let query = "SELECT * FROM controllers WHERE condoid=? ORDER BY name";
      const result = await promisePool
        .query(query, [condoId])
        .then(([rows, fields]) => {
          res.send(rows);
        })
        .catch((err) => {
          console.log(err);
          res.send("Não foi possível acessar as unidades!");
        });
    }
  },
  doLogout(req, res) {
    //----- processo de logout
    console.log(req.session.username);
    console.log(req.session.id);
    req.session.userid = "";
    req.session.loggedin = false;
    res.end();
  },
  async updateCondo(req, res) {
    // atualiza o registro de todas as controladoras do condomínio
    let condoId = req.body.condoId;
    // blockVisitor() // desabilita visitantes com data de validade vencida
    // seleciona todas as controladoras do condomínio no BD
    let query = `SELECT * FROM controllers WHERE condoid=${condoId}`;
    const ctrls = await dbQuery(query);
    // para cada controladora:
    if (ctrls.length > 0) {
      for (let x = 0; x < ctrls.length; x++) {
        //    seleciona todos os usuários que tem acesso a essa controladora (campo type)
        let rNow = moment().format("YYYY-MM-DD HH:mm:ss");
        query = `SELECT * FROM users WHERE condoid=${condoId} AND type<10 AND (dtfinal<${rNow} OR dtfinal IS NULL)`;
        const users = await dbQuery(query);
        //    REMOVE todos os usuário da controladora
        const removerTodos = await axiosGet(ctrls[x].ip, eraseall, ctrls[x].user, ctrls[x].password);
        console.log(removerTodos);
        //para cada usuário
        for (let y = 0; y < users.length; y++) {
          // criar novo usuário/visitante na controladora
          let parametros = {};
          parametros.name = users[y].firstname;
          parametros.card = users[y].card;
          parametros.rfcode = users[y].rfcode;
          parametros.qrcode = users[y].qrcode;
          parametros.fingerprint = users[y].fingerprint;
          parametros.perm1 = users[y].perm;
          parametros.lifecount = users[y].lifecount;
          parametros.key = users[y].responsible;

          const novoUsuario = await axiosPost(ctrls[x].ip, adduser, parametros, ctrls[x].user, ctrls[x].password);
          console.log(novoUsuario);
        }
      }
    }
  },
  async updateCtrl(req, res) {
    //atualiza todos os registros da controladora (manutenção)
  },
  async updateUser(req, res) {
    //atualiza o registro de 1 usuário em todas as controladoras do condomínio
    // seleciona o registro do usuário no BD
    // seleciona as controladoras que o usuário pode acessar (type)
    // para cada controladora:
    // busca usuário na controladora
    // se existe, remover
    // adicionar novo usuário
  },
}; // fim do export
//-------------------------------------------------------------
async function dbQuery(query) {
  const result = await promisePool
    .query(query)
    .then(([rows, fields]) => {
      return rows;
    })
    .catch((err) => {
      console.log(err);
      return false;
    });
}

async function axiosPost(ctrlIp, reqType, params, user, pass) {
  try {
    const response = await axios.post("http://" + ctrlIp + "/?request=" + reqType, params, {
      withCredentials: true,
      auth: {
        username: user,
        password: pass,
      },
    });
    return response;
  } catch (error) {
    console.error(error);
    return false;
  }
}
async function axiosGet(ctrlIp, reqType, user, pass) {
  try {
    const response = await axios.get("http://" + ctrlIp + "/?request=" + reqType, {
      withCredentials: true,
      auth: {
        username: user,
        password: pass,
      },
    });
    return response;
  } catch (error) {
    console.error(error);
    return false;
  }
}
