import Linkt from '@linkt/sdk';

const environment = process.env['LINKT_ENVIRONMENT'] === 'production' ? 'production' : 'staging';

const linkt = new Linkt({
	apiKey: process.env['LINKT_API_KEY'],
	environment,
});

export default linkt;
