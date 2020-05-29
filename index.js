const http = require('http'),
	formidable = require('formidable'),
	jimp = require('jimp'),
	fs = require('fs'),
	path = require('path'),
	urlParse = require('url'),
	mime = require('mime'),
	mongoose = require('mongoose'),
	config = require('./config');

function formatBytes(a, b = 2) { if (0 === a) return "0 Bytes"; const c = 0 > b ? 0 : b, d = Math.floor(Math.log(a) / Math.log(1024)); return parseFloat((a / Math.pow(1024, d)).toFixed(c)) + " " + ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"][d] }

function ID(n) {
	var out = ""
	var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-"

	for (var i = 0; i < n; i++)
		out += chars.charAt(Math.floor(Math.random() * chars.length))

	return out;
}

var uploadSchema = new mongoose.Schema({
	id: String,
	date: { type: Date, default: Date.now() },
	original: String,
	filename: String,
	mime: String
}, { collection: 'upload' });

var Upload = mongoose.model('Upload', uploadSchema)

mongoose.connect("mongodb://odin.home.mathew.pl:27017/sharex", {
	auth: { "authSource": "admin" },
	user: "admin",
	pass: "admin",
	useNewUrlParser: true,
	useUnifiedTopology: true
});

var db = mongoose.connection
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function () {
	console.log('db connected')
	server.listen(config.port)
});

var server = http.createServer(function (req, res) {
	const url = urlParse.parse(req.url)
	if (req.method == 'POST') {
		if (req.url.startsWith('/upload')) {
			var id = ID(8),
				form = formidable({
					multiples: true,
					uploadDir: path.join(__dirname, './upload'),
					maxFileSize: 10e3 * 1024 * 1024
				}),
				ip = req.headers['x-real-ip']

			console.log(`${id} started from ${ip}`)

			form.on('error', function (err) {
				console.log(`${id} failed`);
				console.log(err);
			});

			form.on('aborted', function (err) {
				console.log(`${id} aborted`);
			});

			form.on('end', function () {
				console.log(`${id} done`);

				res.writeHead(200, {
					'Content-Type': 'application/json'
				});
				res.write(JSON.stringify(output))
				res.end()
			});

			form.on('fileBegin', function (name, file) {
				console.log(`${id} expected ${formatBytes(form.bytesExpected)}, name: '${file.name}'`)
				db.collection('upload').insertOne(new Upload({
					id: id,
					original: file.name,
					filename: id,
					mime: file.type
				}))
				file.path = path.join(form.uploadDir, id)
			})
			form.parse(req)

			output = {
				url: {
					image: `https://i.mathew.pl/${id}`,
					thumbnail: "https://i.mathew.pl/low/${id}",
					delete: "https://i.mathew.pl/del/${id}"
				}
			}
		}
	} else if (req.method == 'GET') {
		// var id = url.pathname.split('.')[0].slice(1)
		var id = url.pathname.slice(1)
		Upload.findOne({ id: id }, function (err, file) {
			if (err) console.log(err)
			if (file == null) {
				res.writeHead(404);
				res.end()
				return
			}
			var readStream = fs.createReadStream(path.join(__dirname, 'upload', file.filename));
			readStream.on('open', function () {
				if(['image', 'text'].indexOf(file.mime.split('/')[0]) == -1)
					res.setHeader('Content-Disposition', `attachment; filename="${file.original}"`);
				readStream.pipe(res);
			});
			readStream.on('error', function (err) {
				res.end(err);
			});
		})
	} else {
		res.writeHead(405);
		res.end();
	}
})

