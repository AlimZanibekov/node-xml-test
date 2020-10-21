const { describe, test } = require('@jest/globals');
const { XMLParser } = require('./parser');
const { resolve } = require('path');


describe('XMLParser test', () => {
  const { jest } = require('@jest/globals');

  const logger = {
    error: jest.fn(),
    info: jest.fn(),
  };

  const testGen = (filename, right) => async () => {
    const parser = new XMLParser(resolve(__dirname, '../test', filename), { logger, logging: true });

    const end = new Promise(r => parser.on('finish', r));
    const messages = [];
    parser.on('message', msg => messages.push(msg));
    parser.parse();
    await end;

    for (const { From, Message } of right) {
      const msg = messages.shift();
      expect(msg.From).toBe(From);
      expect(msg.Message).toBe(Message);
    }

    expect(logger.error.mock.calls.length).toBe(0);
  }


  test('Should parse first simple test', testGen('test-simple.xml', [{
    From: 'Joe.doe@gmail.com',
    Message: 'Hi Jane'
  }]));

  test('Should sanitize text inside message', testGen('test-message.xml', [{
    From: 'JANE.DOE@gmail.com',
    Message: '&lt;Message&gt;&lt;From&gt;JANE.DOE@gmail.com&lt;/From&gt;&lt;Message&gt;Great to hear. Neque porro qu' +
      'isquam est qui dolorem ipsum quia dolor sit amet,&lt;script&gt;console.error(String.fromCharCode(72, 65, 67, ' +
      '75, 69, 68))&lt;/script&gt;consectetur, adipisci velit...&lt;/Message&gt;&lt;/Message&gt;Great to hear. Neque' +
      ' porro quisquam est qui dolorem ipsum quia dolor sit amet,&lt;script&gt;console.error(String.fromCharCode(72,' +
      ' 65, 67, 75, 69, 68))&lt;/script&gt;consectetur, adipisci velit...'
  }]));

  test('Should sanitize "From" message field', testGen('test-external.xml', [{
    From: 'JANE.DOE@gmail.com&lt;From&gt;blah.DOE@gmail.com&lt;/From&gt;',
    Message: '&lt;Message&gt;ABC&lt;/Message&gt;Great to hear. Neque porro quisquam est qui dolorem ipsum quia dolor' +
      ' sit amet,&lt;script&gt;console.error(String.fromCharCode(72, 65, 67, 75, 69, 68))&lt;/script&gt;consectetur,' +
      ' adipisci velit...'
  }]));

  test('Should throw an error when parsing invalid xml', async () => {
    const parser = new XMLParser(resolve(__dirname, '../test/test-invalid.xml'), { logger, logging: true });
    const end = new Promise(r => {
      parser.on('finish', r);
      parser.on('error', r);
    });
    const messages = [];
    parser.on('message', msg => messages.push(msg));
    let error;
    parser.on('error', err => {
      error = err;
    });
    parser.parse();
    await end;
    expect(error?.message).toBe('Invalid xml format');
  });
})
