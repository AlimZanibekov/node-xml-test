const { EventEmitter } = require('events');
const fs = require('fs');
const Parser = require('node-xml-stream');

/** Class for parsing xml messages. */
class XMLParser extends EventEmitter {
  static STATE = {
    ZERO: 0,
    MESSAGE: 1,
    MESSAGE_SANITIZE: 2,
    MESSAGE_FIELD: 3
  };

  static TAGS = {
    MESSAGE: 'Message',
    FROM: 'From',
    FILE_DUMP: 'FileDump',
  };

  _state = XMLParser.STATE.ZERO;
  _sanitizeEnd = 0;
  _depth = 0;
  _message = {};
  _text = '';
  _stream;

  /**
   * Create a xml parser
   * @param {string} path - Path to xml file.
   * @param {any} options - Parser options { logging {boolean}, logger{any} }
   * File format:
   * |  <FileDump>
   * |    <Message>
   * |      <From>Joe.doe@gmail.com</From>
   * |      <Message>Hi Jane</Message>
   * |    </Message>
   * |    ...
   * */
  constructor(path, options = {
    logging: false,
    logger: console
  }) {
    super();
    this.path = path;
    this.logging = options.logging;
    this.logger = options.logger;

    const parser = new Parser();

    parser.on('opentag', this._onOpenTag);
    parser.on('closetag', this._onCloseTag);
    parser.on('text', this._onText);
    parser.on('error', this._onError);
    parser.on('finish', this.emit.bind(this, 'finish'));

    this._parser = parser;
  }

  /**
   * Run parsing.
   * Run only after subscribing to events
   * */
  parse() {
    this._stream = fs.createReadStream(this.path);
    this._stream.pipe(this._parser);
  }

  /**
   * Stop parsing.
   * */
  close() {
    if (this._stream) {
      this._stream.close();
    } else {
      throw new Error('No stream running');
    }
  }

  _throwInvalidFile() {
    this._stream.close();
    if (this.logging) {
      this.logger.error('Invalid xml format');
    }
    this.emit('error', new Error('Invalid xml format'));
  }

  _onOpenTag = (name, attrs) => {
    switch (this._state) {
      case XMLParser.STATE.ZERO:
        if (name === XMLParser.TAGS.MESSAGE) {
          this._state = XMLParser.STATE.MESSAGE;
          if (this.logging) {
            this.logger.info('State: ZERO, found <Message> tag');
          }
        }
        break;
      case XMLParser.STATE.MESSAGE:
        if (name === XMLParser.TAGS.MESSAGE || name === XMLParser.TAGS.FROM) {
          this._state = XMLParser.STATE.MESSAGE_FIELD;
          this._sanitizeEnd = this._depth + 1;
          if (this.logging) {
            this.logger.info(`State: MESSAGE, found message tag field "${name}"`);
          }
        } else {
          this._throwInvalidFile();
        }
        break;
      case XMLParser.STATE.MESSAGE_FIELD:
      case XMLParser.STATE.MESSAGE_SANITIZE:
        if (this.logging) {
          this.logger.info(`State: ${
            XMLParser.STATE.MESSAGE_FIELD
              ? 'MESSAGE_FIELD'
              : 'MESSAGE_SANITIZE'
          }, tag: "${name}"`);
        }
        this._state = XMLParser.STATE.MESSAGE_SANITIZE;
        const tagAttrs = Object.entries(attrs)
          .map(([key, value]) => ` ${key}="${value}"`)
          .join('');

        this._text += `&lt;${name}${tagAttrs}&gt;`;
        break;
    }
    this._depth++;
  };

  _onCloseTag = (name) => {
    this._depth--;
    switch (this._state) {
      case XMLParser.STATE.ZERO:
        if (name !== XMLParser.TAGS.FILE_DUMP) {
          this._throwInvalidFile();
        }
        break;
      case XMLParser.STATE.MESSAGE:
        if (this.logging) {
          this.logger.info('State: MESSAGE, parsed message:', JSON.stringify(this._message));
        }
        this._state = XMLParser.STATE.ZERO;
        this.emit('message', this._message);
        this._message = {};
        break;
      case XMLParser.STATE.MESSAGE_FIELD:
        if (this.logging) {
          this.logger.info('State: MESSAGE_FIELD, accumulator:', this._text);
        }
        this._state = XMLParser.STATE.MESSAGE;
        this._message[name] = this._text;
        this._text = '';
        break;
      case XMLParser.STATE.MESSAGE_SANITIZE:
        if (this.logging) {
          this.logger.info('State: MESSAGE_SANITIZE, accumulator:', this._text);
        }
        if (this._depth === this._sanitizeEnd) {
          this._state = XMLParser.STATE.MESSAGE_FIELD;
        }
        this._text += `&lt;/${name}&gt;`;
        break;
    }
  };

  _onText = (text) => {
    this._text += text;
  };

  _onError = (err) => {
    if (this.logging) {
      this.logger.error('Parser error:', err.message);
    }
    this.emit('error', err);
  };
}

module.exports = { XMLParser };
