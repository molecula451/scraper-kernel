import fs from "fs";
import path from "path";
import { PageLogic } from "../event-handlers";
// import { log } from '../../../../utils';
import { log } from "../../logging";

export type DestinationStrategy = (destination: string) => string;

export function resolveProjectPath() {
  const projectPath = path.resolve(require.main?.filename as string, "..", "..");
  if (!projectPath) {
    throw new Error("no project path resolved");
  }
  return projectPath;
}

const cwd = resolveProjectPath();
const cwdParentName = path.join(cwd, "..");

export async function searchForImport(importing: string, startPosition?: string): Promise<PageLogic> {
  return await _searchForImport(importing, startPosition ? startPosition : importing);
}

async function _searchForImport(importing: string, startPosition: string) {
  if (importing.endsWith(path.sep)) {
    // normalize requested path name to remove trailing slash
    importing = importing.slice(0, -1);
  }

  if (!importing.includes(cwd)) {
    log.error(`out of bounds`);
    importing = startPosition = path.resolve(startPosition, ".."); // go up one directory from `startPosition`
  }

  const logic = (await checkModifier(importing, "index.ts")) || (await checkModifier(importing, "*"));

  if (logic) {
    return logic;
  } else {
    const wildCardPath = renameLastPartOfPathToWildCard(importing); // pathname ends with */*
    return await _searchForImport(wildCardPath, startPosition);
  }
}

export function renameLastPartOfPathToWildCard(query: string) {
  const pathParts = query.split(path.sep); // for windows "\" and unix "/" like separators
  let x = pathParts.length;
  while (x--) {
    // fast reverse loop
    const part = pathParts[x];
    if (part !== "*") {
      // rename latest path part
      pathParts[x] = "*";
      break;
    }
  }
  const resolvedPath = pathParts.join(path.sep);
  if (!resolvedPath.includes(cwdParentName)) {
    // @TODO: `cwdParentName` check could be implemented better, but for now, it works.
    // THE REQUESTED IMPORT PATH IS OUTSIDE OF THE PROJECT DIRECTORY, WHICH IS INVALID
    log.error(`requested: ${resolvedPath}`);
    log.error(`directory: ${cwdParentName}`);
    throw new Error("the requested page logic import path is outside of the project directory, which is invalid");
  }

  return resolvedPath;
}

async function checkModifier(importing: string, modifier: string) {
  const importingDestination = path.resolve(importing, modifier);
  if (fs.existsSync(importingDestination)) {
    const logic = (await import(importingDestination))?.default;
    if (logic) {
      log.ok(`"${importingDestination}" module loaded successfully`);
      return logic as PageLogic;
    }
  } else {
    log.info(`"${importingDestination}" not found`);
    return null;
  }
}
