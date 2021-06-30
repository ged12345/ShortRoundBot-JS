class Mailgun {
    static mailgun = require('../coin-bot/mailgun-js');
    static DOMAIN = 'sandboxb15a9e419a07486cb2cbb21b1984a2e7.mailgun.org';
    static mg = mailgun({
        apiKey: '1c4edbb2238cdaddb84a56b443117d2e-aff8aa95-886850ec',
        domain: Malgun.DOMAIN,
    });
    static data = {
        from: 'spillmytincture@gmail.com',
        to: '',
        subject: 'Corduroy Wolf - Bot is down!',
        text: '',
    };

    static sendEmail(email, botName) {
        Mailgun.data.to = email;
        Mailgun.data.text = `Your bot ${botName} is down! Please inform your administrator because you're currently losing money.`;
        mg.messages().send(Mailgun.data, function (error, body) {
            console.log(body);
        });
    }

