var argv = require('optimist').argv;
var inspect = require('util').inspect;
var fs = require('fs');
var PushBullet = require('pushbullet');
var Notifier = require('mail-notifier');

/*
 * Command line arguments
 * user: The email address to monitor via IMAP
 * pass: The email account password
 * host: The IMAP server address, defaults to Gmail
 * port: The IMAP port
 * pbkey: Pushbullet API key for using Pushbullet integration
 * pbuser: Pushbullet email account to receive notifications
 */
var user = argv.email;
var pass = argv.password;
var host = argv.host || "imap.gmail.com";
var port = argv.port || 993;
var pbkey = argv.pushbullet;
var pbuser = argv.pbuser;

if (!user) {
  throw "Please specify a username (--user)";
}

if (!pass) {
  throw "Please specify a password (--pass)";
}

/*
 * Logging function that adds date
 */
function log(msg) {
  var logOutput = new Date() + " " + msg + "\n";
  fs.appendFileSync("log.txt", logOutput);
  // console.log(logOutput);
}

/*
 * Where all the magic happens. Process the email body, update the remaining balance, notify me
 */
function magic(emailBody) {
  // Find and store the transaction amount
  var regex = /[1-9]+\d*\.\d{2}/gm;
  var transactionAmount = emailBody.match(regex);

  log("Transaction amount parsed: " + transactionAmount);

  // Update local data store with new remaining balance
  var oldValue;
  var newValue;

  function readFile(callback) {
    oldValue = fs.readFileSync('data', 'utf8');
    newValue = oldValue - transactionAmount;
    newValue.toFixed(2);

    return callback(function () {
      return true;
    });
  }
  function writeFile(callback) {
    if (newValue) { // Protect against overwriting old value if new value is undefined
      log("New value is " + newValue);
      fs.writeFileSync('data', newValue, 'utf8');
    } else {
      throw ("Error calculating new value; New Value calculated is " + newValue);
    }
    return callback();
  }
  if (transactionAmount) { // Only update file if a value was found
    readFile(writeFile); // Callback
  } else {
    log("No transaction to process");
  }

  // Notify via Pushbullet
  function notify() {
    log("Sending update to Pushbullet user");
    var pusher = new PushBullet(pbkey);
    pusher.note(pbuser, "Budget Update", "You have $" + newValue + " left to spend this month", function (error, response) {});
  }
  notify(); // Notify via Pushbullet
}

// Create and start IMAP IDLE client
var imapConfig = {
  user: user,
  password: pass,
  host:     host,
  port:     port,
  tls: true,
  tlsOptions: { rejectUnauthorized: false },
  box: "INBOX",
  markSeen: true
};

var imapClient = new Notifier(imapConfig);

imapClient.on("error", function (error) {
  log("Error: " + error);
});

imapClient.on('mail', function (mail) {
  log("Message from:" + JSON.stringify(mail.from[0])); //[{address:'sender@example.com',name:'Sender Name'}]
  magic(mail.text.toString());
});

imapClient.start();
