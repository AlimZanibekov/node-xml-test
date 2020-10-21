const { XMLParser } = require('./src/parser');
const { DB } = require('./src/db');

const parser = new XMLParser(__dirname + '/CodeTest-XML.xml', {
  logging: process.env.NODE_ENV !== 'production',
  logger: console
});

parser.on('message', (message) => {
  DB.save(message);
});

parser.on('error', (err) => {
  console.error(err);
});

parser.on('finish', () => {
  console.log('Finished');
});

parser.parse();
