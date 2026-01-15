export { readFile } from './readFile';
export { writeFile } from './writeFile';
export { editFile } from './editFile';
export { execCommand } from './execCommand';

import { readFile } from './readFile';
import { writeFile } from './writeFile';
import { editFile } from './editFile';
import { execCommand } from './execCommand';

export const allTools = [readFile, writeFile, editFile, execCommand];
