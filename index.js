var MicroService = require('persephone-ms');
var ms = new MicroService();
ms.log.transports.console.level = 'info'; // TODO: Move this into a config option handled by the ms framework.
