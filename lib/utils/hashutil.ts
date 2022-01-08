import * as crypto from 'crypto'

export class HashUtil {

    /**
     * generateIDSafeHash util creates a sha256 hash out of the contents passed, base64 encodes
     * the results, and then removed any non-alphanumeric values from the hash. This way the
     * resulting hash is safe and valid to pass within the CDK construct id parameters, and is
     * ensured to be unique and consistently reproducible given the same contents
     * @param contentToHash string - contents to be hashed, a unique but reproducible hash will be generated off this content
     * @param lengthOfHash number - the length of the hash. Being sha256 underneath. This parameter is ineffective if larger
     * then 256. If a larger or equal to the actual hash length is given, the full hash as available is returned. If the value is smaller
     * then the hash will be truncated off the end to the appropriate length
     * @returns string - string representation of the hash
     */
    public static generateIDSafeHash(contentToHash:string, lengthOfHash: number):string{
        const crHash = crypto.createHash('sha256')
        crHash.update(contentToHash)
        const hash = crHash.digest('base64')
        const alphanumericHash = hash.replace(/\W/g, '')
        if(lengthOfHash >= alphanumericHash.length){
            return alphanumericHash
        }else{
            return alphanumericHash.substr(0, lengthOfHash)
        }
    }
}