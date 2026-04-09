import { inject } from 'inversify';
import { controller, httpGet } from 'inversify-express-utils';
import { Request, Response } from 'express';
import { AddressService } from '../services/address.service';
import { TYPES } from '../types';

@controller('/pincode')
export class AddressController {
  constructor(
    @inject(TYPES.AddressService)
    private readonly addressService: AddressService,
  ) {}

  @httpGet('/fetchAddressByPincode')
  async fetchAddressByPincode(req: Request, res: Response) {
    const { pincode } = req.query;

    if (!pincode || typeof pincode !== 'string') {
      return res.status(400).json({ error: 'Pincode must be a string' });
    }

    if (!/^\d{6}$/.test(pincode)) {
      return res.status(400).json({ error: 'Pincode must be a 6-digit number string' });
    }

    try {
      const address = await this.addressService.fetchAddressByPincode(pincode);
      return res.status(200).json(address);
    } catch (err: any) {
      return res.status(404).json({ error: err.message });
    }
  }
}
