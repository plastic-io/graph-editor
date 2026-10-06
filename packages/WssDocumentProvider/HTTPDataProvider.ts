import {authorizedFetch} from '@plastic-io/graph-editor-vue3-authentication-provider';
export default class HTTPDataProvider {
    baseUrl: string;
    constructor(baseUrl: string) {
        if (!baseUrl) throw new Error('No base url was passed to HTTPDataProvider');
        this.baseUrl = baseUrl.replace(/\/+$/, '') + '/';
    }
    async set(url: string, value: any) {
        const response = await authorizedFetch(this.baseUrl + url, { method: 'POST', body: value });
        return response.json();
    }
    async get(url: string) {
        const response = await authorizedFetch(this.baseUrl + url);
        return response.json();
    }
}
