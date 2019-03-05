import { WorkerApplication as Application } from '../WorkerApplication';
import { TbasePlugin } from './TbasePlugin';
import express = require('express');
export declare class ThttpPlugin extends TbasePlugin {
    app: express.Application;
    constructor(application: Application, config: any);
    install(): void;
}
