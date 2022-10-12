const io = require("socket.io-client");
const { v4: uuidv4 } = require("uuid");
const dockerstats = require("dockerstats");
const axios = require("axios");
const fs = require("fs");

const socket = io("http://reporting.billing.yourdomain.com:3000/");
const certUrl = `https://billing.yourdomain.com/api/sys/certs/privateservers`;
const certPath = "/etc/letsencrypt/live";

socket.on("connect", () => {
  socket.emit("registerAsServer");
});

var cache = {
  servers: [],
  stats: [],
};

const nodeId = uuidv4();

async function syncCert() {
  axios({
    method: "get",
    url: certUrl,
  }).then(function (response) {
    console.log(response);
  });
}

async function refresh() {
  cache.stats = await dockerstats.dockerContainerStats();
  cache.servers = await dockerstats.dockerContainers();
  socket.emit("dockerMetrics", {
    nodeId: nodeId,
    cache,
  });
  refresh();
}

async function syncCert() {
  axios({
    method: "get",
    url: certUrl,
  }).then(function (response) {
    if (response.status == 200) {
      //console.log(response.data)

      const cert = response.data.cert;
      const key = response.data.key;

      //find the correct folder with the certificates;
      const folderContents = fs.readdirSync(certPath);
      const targetFolder = `${certPath}/${folderContents[0]}`;

      //write cert
      fs.writeFileSync(`${targetFolder}/fullchain.pem`, cert);

      //write key
      fs.writeFileSync(`${targetFolder}/privkey.pem`, key);

      console.log("Updated certificates");
      //console.log(targetFolder)
    } else {
      console.error("Something went wrong while updating certificates");
    }
  });
}

//send first data packet with docker container info
refresh();

//sync certs 10s after boot
setTimeout(() => {
  syncCert();
}, 10 * 1000);

//update cert if new one is availabe.
socket.on("updatePrivateCertificate", () => {
  syncCert();
});
