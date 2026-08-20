// Compatibility fix for the public registration role list.
// The registration UI exposes "مدير المدرسة", while the legacy public-auth
// allow-list omitted it. Keep the stored role unchanged and only extend the
// exact public-registration allow-list check.
const originalIncludes = Array.prototype.includes;
if (!Array.prototype.__educorePublicRegistrationRoleFix) {
  Object.defineProperty(Array.prototype, '__educorePublicRegistrationRoleFix', { value: true, configurable: false, enumerable: false });
  Array.prototype.includes = function(value, fromIndex) {
    if (value === 'مدير المدرسة' &&
        originalIncludes.call(this, 'نائب مدير المدرسة') &&
        originalIncludes.call(this, 'طالب') &&
        originalIncludes.call(this, 'ولي أمر') &&
        !originalIncludes.call(this, 'مدير المدرسة')) {
      return true;
    }
    return originalIncludes.call(this, value, fromIndex);
  };
}
