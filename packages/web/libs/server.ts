import { CustomHttpRequest } from '@angel-bridge/common';
import axios, { AxiosInstance } from 'axios';

import publicEnv from './public-env';

class ServerAPI {
  private _api: AxiosInstance;

  constructor() {
    this._api = axios.create({
      baseURL: `${publicEnv.NEXT_PUBLIC_BACKEND_URL}/server`,
      withCredentials: true,
    });
  }

  async get<P extends Record<keyof CustomHttpRequest, unknown>>(
    url: string,
    params: P['query'] = {},
  ) {
    return await this._api.get<P['res']>(url, {
      params,
    });
  }

  async post<P extends Record<keyof CustomHttpRequest, unknown>>(
    url: string,
    payload: P['body'],
    params: P['query'] = {},
  ) {
    return await this._api.post<P['res']>(url, payload, {
      params,
    });
  }

  async putWithCredentials<P extends Record<keyof CustomHttpRequest, unknown>>(
    url: string,
    payload: P['body'],
    params: P['query'] = {},
  ) {
    return await this._api.put<P['res']>(url, payload, {
      params,
      withCredentials: true,
    });
  }

  async delete<P extends Record<keyof CustomHttpRequest, unknown>>(
    url: string,
    params: P['query'] = {},
  ) {
    return await this._api.delete<P['res']>(url, {
      params,
    });
  }

  async patch<P extends Record<keyof CustomHttpRequest, unknown>>(
    url: string,
    payload: P['body'],
    params: P['query'] = {},
  ) {
    return await this._api.patch<P['res']>(url, payload, {
      params,
    });
  }
}

const api = new ServerAPI();

export default api;
