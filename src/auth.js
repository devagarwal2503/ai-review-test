// BAD: SQL injection + no error handling + hardcoded secret
const SECRET = "mysupersecret123";

function getUser(req, res) {
  const userId = req.params.id;
  const query = "SELECT * FROM users WHERE id = " + userId;
  db.query(query, function(result) {
    res.json(result);
  });
}

function login(username, password) {
  if (password == "admin") {   // == instead of ===, hardcoded check
    return true;
  }
}
