const http = require('http')
const express = require('express')
const { body, validationResult } = require('express-validator')

const qrcode = require('qrcode-terminal')
const { Client, LocalAuth } = require('whatsapp-web.js')

const color = require('chalk')

const port = 8080

const app = express()
const server = http.createServer(app)

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
		headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process', // this one doesn't works in Windows
            '--disable-gpu'
        ]
	}
})

const logging = (symbol, log) => {
    console.log(` ${color.gray('[') + symbol + color.gray(']')} ${log}`)
}

const checkRegisteredNumber = async (number) => {
    return await client.isRegisteredUser(number)
}

const phoneNumberFormat = (number) => {
    let formatted = number.replace(/\D/g, '')

    if (formatted.startsWith('0'))      formatted = '62' + formatted.substr(1)
    if (! formatted.endsWith('@c.us'))  formatted += '@c.us'

    return formatted
}

client.on('qr', qr => {
    logging(color.red('?'), color.red('whatsapp need authentication'))
    qrcode.generate(qr, {small: true})
})

client.on('ready', () => logging(color.green('*'), color.green('whatsapp is running')))
client.on('disconnected', () => logging(color.red('!'), color.red('whatsapp disconneted')))

client.on('message', message => {
	if (message.body === '!ping') {
		message.reply('pong : ' + message.from)
	}
})

client.initialize()

app.post('/send/message', [
    body('number').notEmpty(),
    body('message').notEmpty()
], (req, res) => {
    const validate = validationResult(req).formatWith(({ msg }) => msg)

    if (! validate.isEmpty()) {
        return res.status(422).json({
            status: 'failed',
            message: validate.mapped()
        })
    }

    const number  = phoneNumberFormat(req.body.number)
    const message = req.body.message

    const isRegisteredNumber = checkRegisteredNumber(number)

    if (! isRegisteredNumber) {
        return res.status(422).json({
            status: 'failed',
            message: 'number phone is not registered in whatsapp'
        })
    }

    client.sendMessage(number, message).then(() => {
        logging(color.green('+'), `${color.bgGreen('request:')} send message to ${number.slice(0, -5)}`)

        res.status(200).json({
            status: 'success',
            message: 'successful'
        })
    }).catch((err) => {
        logging(color.red('-'), `${color.bgRed('request:')} failed send a message to ${number.slice(0, -5)}`)

        res.status(500).json({
            status: 'failed',
            message: 'fail' + err
        })
    })
})

server.listen(port, () => {
    logging(color.green('*'), `app running in port ${color.green.underline(port)}`)
    logging(color.gray('!'), color.gray('whatsapp is starting'))
})