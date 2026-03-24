import fs   from 'fs';
import path  from 'path';
import { Plugin, ToolDefinition } from '../types';

export interface PluginManifest {
  name:        string;
  version:     string;
  description: string;
  entrypoint:  string;
  author?:     string;
  homepage?:   string;
}

export class PluginManager {
  private plugins: Map<string, Plugin>          = new Map();
  private manifests: Map<string, PluginManifest> = new Map();

  register(plugin: Plugin, manifest?: Partial<PluginManifest>): void {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`plugin already registered: ${plugin.name}`);
    }
    this.plugins.set(plugin.name, plugin);
    this.manifests.set(plugin.name, {
      name:        plugin.name,
      version:     plugin.version,
      description: manifest?.description ?? '',
      entrypoint:  manifest?.entrypoint  ?? '',
      author:      manifest?.author,
      homepage:    manifest?.homepage,
    });
  }

  async loadFromDir(dir: string): Promise<void> {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const manifestPath = path.join(dir, entry.name, 'plugin.json');
      if (!fs.existsSync(manifestPath)) continue;

      try {
        const manifest: PluginManifest = JSON.parse(
          fs.readFileSync(manifestPath, 'utf-8'),
        );
        const entryPath = path.resolve(dir, entry.name, manifest.entrypoint);
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod    = require(entryPath);
        const plugin = mod.default ?? mod;
        this.register(
          typeof plugin === 'function' ? new plugin() : plugin,
          manifest,
        );
        console.log(`[plugins] loaded: ${manifest.name}@${manifest.version}`);
      } catch (err) {
        console.warn(`[plugins] failed to load ${entry.name}: ${(err as Error).message}`);
      }
    }
  }

  get(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  getAll(): Plugin[] {
    return [...this.plugins.values()];
  }

  getAllTools(): ToolDefinition[] {
    return this.getAll().flatMap((p) => p.tools);
  }

  async dispatch(toolName: string, args: Record<string, unknown>): Promise<string> {
    for (const plugin of this.plugins.values()) {
      if (plugin.tools.some((t) => t.name === toolName)) {
        return plugin.execute(toolName, args);
      }
    }
    throw new Error(`no plugin handles tool: ${toolName}`);
  }

  list(): PluginManifest[] {
    return [...this.manifests.values()];
  }
}
