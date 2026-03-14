// src/app/pipes/apply.pipe.ts
import { Pipe, PipeTransform } from '@angular/core';

/**
 * Apply pipe - applies a function to a value
 * Usage: {{ value | apply:functionName }}
 */
@Pipe({ name: 'apply', standalone: true })
export class ApplyPipe implements PipeTransform {
  transform(value: any, fn: (value: any) => any): any {
    return fn ? fn(value) : value;
  }
}
